'use client';

import React from "react";
import assert from "assert";
import { v4 as uuidv4 } from "uuid";
import { suggestionIdAttribute } from "./Suggestion";
import { LRUCache } from 'lru-cache'
import { useRef, SyntheticEvent, KeyboardEvent } from "react";
import { isCaretAtLineEnd, generateSuggestionElement, getTextUptilCaretInElement, insertNodeAtCaret } from "./utils";
import { SuggestionInfo, SuggestionRemovalReason, AutocompleteTextboxProps, GetSuggestionFn } from "./types";

export default function AutocompleteTextbox({
  disableAutocomplete,
  debounceTime,
  getSuggestion,
  onContentChange,
  onSuggestionShown,
  onSuggestionAccepted,
  onSuggestionRejected,
  ...props
}: AutocompleteTextboxProps) {
  const DEBOUNCE_TIME = debounceTime || 1000;
  const textbox = useRef<HTMLDivElement | null>(null);
  const timer = useRef<NodeJS.Timeout>(setTimeout(() => { }, 0));
  const disableSelectionEvent = useRef<boolean>(false);
  const abortController = useRef(new AbortController()); // Create an abort controller to cancel the fetch request if the user has typed ahead
  // Create a ref to store the cache
  const suggestionCache = useRef(new LRUCache<string, string>({ max: 25 }));

  const isSuggestionDisplayed = (): boolean => {
    const suggestionElements = textbox.current?.querySelectorAll(`[${suggestionIdAttribute}]`);
    if (!suggestionElements) return false;
    return suggestionElements.length > 0;
  };

  const getCurrentSuggestionElement = (): Element | null => {
    const suggestionElements = textbox.current?.querySelectorAll(`[${suggestionIdAttribute}]`);
    if (!suggestionElements || suggestionElements.length == 0) return null;
    return suggestionElements[0];
  }

  /**
   * Shows a suggestion at the caret position in the AutocompleteTextbox.
   * @param getSuggestion - A function that returns the suggestion text based on the text up until the caret position.
   * @returns void
   */
  const showSuggestionAtCaret = async (getSuggestion: GetSuggestionFn): Promise<void> => {
    removeSuggestionIfDisplayed(SuggestionRemovalReason.SYSTEM); // Sanity check: remove any existing suggestion

    // Get the suggestion
    const textUptilCaret = getTextUptilCaretInElement(textbox.current!);
    const timeBefore = Date.now();
    // Get the suggestion from the cache or from the getSuggestion function
    let suggestionText = suggestionCache.current.get(textUptilCaret);
    if (!suggestionText) {
      abortController.current = new AbortController(); // This will be used to cancel the fetch if the user types something else
      suggestionText = await getSuggestion(textUptilCaret, abortController.current.signal); // Call the user-provided function (abortcontroller will be ignored if the user-provided function doesn't use it)
      if (!suggestionText) return; // If there's no suggestion (e.g. API error), don't show anything
      suggestionCache.current.set(textUptilCaret, suggestionText);
    }
    const timeAfter = Date.now();

    // Interesting bug found later:
    // If the user types something while the suggestion is being fetched, the suggestion may not be relevant anymore
    // So, we'll check if the leading text is still the same. If not, we won't show the suggestion (this is a heuristic, not perfect).
    const textUptilCaretAfterFetch = getTextUptilCaretInElement(textbox.current!);
    if (textUptilCaret !== textUptilCaretAfterFetch) return;

    // Prepare the suggestion element
    const suggestionId = 's-' + uuidv4();
    const suggestionElement = generateSuggestionElement(suggestionText, suggestionId, props.suggestionClassName, props.suggestionStyle);
    const isSuccessfullyInserted = insertNodeAtCaret(suggestionElement, textbox.current!, true);

    // Update the suggestion status
    if (isSuccessfullyInserted) {
      const suggestionInfo: SuggestionInfo = {
        id: suggestionId,
        timeShown: Date.now(),
        latency: timeAfter - timeBefore,
        suggestionText: suggestionText,
        leadingText: textUptilCaret,
        getFullHTML: () => textbox.current?.innerHTML || ""
      };
      onSuggestionShown?.(suggestionInfo);
    }
  };

  const removeSuggestionIfDisplayed = (reason: SuggestionRemovalReason): void => {
    /**
     * Find and remove all elements with the attribute suggestionIdAttribute.
     * Note: Usually, this would be just one element. But there's a corner case that I can't figure out,
     * where a past suggestion is not removed leading to multiple suggestions being displayed.
     * So, I'm removing all suggestion elements to be safe. Redundancy is better than a bug.
     */
    const suggestionElements = textbox.current?.querySelectorAll(`[${suggestionIdAttribute}]`);
    if (!suggestionElements) return;
    suggestionElements.forEach(suggestionElement => {
      const suggestionId = suggestionElement.getAttribute(suggestionIdAttribute)!;
      suggestionElement.remove();
      // Call the onSuggestionRejected callback given by the user (unless the reason for removal was internal)
      if (reason !== SuggestionRemovalReason.SYSTEM) {
        onSuggestionRejected?.({
          suggestionId,
          timeRejected: Date.now(),
          reason
        });
      }
    });
  };

  const handleInput = (event: SyntheticEvent<HTMLDivElement>): void => {
    if (disableAutocomplete) {
      onContentChange?.(textbox.current?.innerHTML || "");
      return;
    }

    /*
     * If there's an active suggestion and the user's input matches with the initial substring
     * of the suggestion, remove that suggestion and show a new one with the remaining substring.
     */
    if (isSuggestionDisplayed()) {
      const justTyped = (event.nativeEvent as InputEvent).data;
      const suggestionText = getCurrentSuggestionElement()!.textContent!;
      const inputMatchesSuggestion = justTyped && suggestionText?.startsWith(justTyped);
      if (inputMatchesSuggestion) {
        removeSuggestionIfDisplayed(SuggestionRemovalReason.IMPLICIT);
        // Call the onContentChange callback given by the user
        // Intentionally calling this here to avoid including the suggestion in the content
        onContentChange?.(textbox.current?.innerHTML || "");

        const remainingSuggestion = suggestionText!.substring(justTyped!.length);
        if (remainingSuggestion) { // it may be empty by now if the user just typed the last character of the suggestion
          showSuggestionAtCaret(() => remainingSuggestion); // show the suggestion without the initial substring
          disableSelectionEvent.current = true; // If I don't do this, the change event will hide the rest of the suggestion (because this shifts the caret)
        }
        return;
      }
    }
    // If a suggestion is displayed, remove it
    removeSuggestionIfDisplayed(SuggestionRemovalReason.IMPLICIT);

    // Call the onContentChange callback given by the user
    onContentChange?.(textbox.current?.innerHTML || "");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disableAutocomplete) return;

    if (event.key === "Escape") {
      event.preventDefault();
      removeSuggestionIfDisplayed(SuggestionRemovalReason.EXPLICIT);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      if (!isSuggestionDisplayed()) return;

      // Accept the suggestion and remove it
      const suggestion = getCurrentSuggestionElement()!;
      const suggestionText = suggestion.textContent;
      assert(suggestionText);
      const suggestionId = suggestion.getAttribute(suggestionIdAttribute)!;
      removeSuggestionIfDisplayed(SuggestionRemovalReason.SYSTEM);
      const textNode = document.createTextNode(suggestionText);
      const isInserted = insertNodeAtCaret(textNode, textbox.current!, false, true);
      if (!isInserted) return; // Sanity check: if the suggestion wasn't inserted, don't proceed

      // Call the onSuggestionAccepted callback given by the user
      onSuggestionAccepted?.({
        suggestionId,
        timeAccepted: Date.now()
      });

      // This is an input change, so trigger the input event manually
      const simulatedEvent = new Event('input', { bubbles: true });
      textbox.current?.dispatchEvent(simulatedEvent);
      return;
    }
  };

  const clearTimerAndAbortFetch = () => {
    clearTimeout(timer.current);
    abortController.current.abort();
  };

  const handleSelection = (event: SyntheticEvent<HTMLDivElement>) => {
    if (disableAutocomplete) return;

    if (disableSelectionEvent.current) {
      disableSelectionEvent.current = false;
      return;
    }

    // If a suggestion is displayed, remove it
    removeSuggestionIfDisplayed(SuggestionRemovalReason.IMPLICIT);

    // Clear the timer if it exists
    clearTimerAndAbortFetch();

    let selection = window.getSelection(); // guaranteed to be within the textbox (called onSelection of the textbox)
    if (!selection || !selection.isCollapsed) return;

    assert(textbox.current);
    const showSuggestion = isCaretAtLineEnd(selection, textbox.current);

    // If showSuggestion is true, start a new timer to show the suggestion
    if (showSuggestion) {
      timer.current = setTimeout(async () => await showSuggestionAtCaret(getSuggestion), DEBOUNCE_TIME);
    }
  };

  const handleBlur = () => {
    removeSuggestionIfDisplayed(SuggestionRemovalReason.IMPLICIT);
    clearTimerAndAbortFetch();
  };

  return (
    <div
      contentEditable={props.disabled ? "false" : "true"}
      ref={textbox}
      onInput={(event) => handleInput(event)}
      onSelect={(event) => handleSelection(event)}
      onKeyDown={(event) => handleKeyDown(event)}
      onBlur={handleBlur}
      {...props}
    >
    </div>
  );

};