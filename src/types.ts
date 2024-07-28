/**
 * Represents the props for the AutocompleteTextbox component.
 */
export interface AutocompleteTextboxProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * A function that retrieves suggestions based on user input.
   * Usually, this will be some sort of API call to a language model.
   * 
   * When a user types, react-ghost-text will call this function with the text up
   * to the caret position, and display the suggestion returned by this function as
   * ghost text.
   * 
   * See the `GetSuggestionFn` type for information about the parameters and return
   * value of this function.
   */
  getSuggestion: GetSuggestionFn;

  /**
   * An optional callback function that is called after a suggestion has been shown.
   */
  onSuggestionShown?: (event: SuggestionInfo) => void;

  /**
   * An optional callback function that is called when a suggestion is accepted.
   */
  onSuggestionAccepted?: (event: SuggestionAcceptedInfo) => void;

  /**
   * An optional callback function that is called when a suggestion is rejected.
   */
  onSuggestionRejected?: (event: SuggestionRejectedInfo) => void;

  /**
   * An optional callback function that is called when the content of the textbox changes.
   * It is called with the current content of the textbox (as HTML string).
   * Note: This does not include the suggestion – only the main text input by the user.
   */
  onContentChange?: (content: string) => void;

  /**
   * The CSS class name for the span element that contains the suggestion.
   * This is useful for styling the suggestion. Default is `"suggestion"`.
   * Your className will override the default class name.
   */
  suggestionClassName?: string;

  /**
   * The inline style for the span element that contains the suggestion.
   * This is useful for styling the suggestion. Default is `{ color: "grey" }`.
   * Your style will override the default style.
   */
  suggestionStyle?: React.CSSProperties;

  /**
   * Disable autocomplete for the component.
   */
  disableAutocomplete?: boolean;

  /**
   * The time to wait after the user stops typing before fetching a suggestion (in ms).
   * Default is 1000ms.
   */
  debounceTime?: number;

  /**
   * Disable the textbox from being edited.
   */
  disabled?: boolean;

  /**
   * The initial content of the textbox.
   */
  value?: string;
}

/**
 * Represents information about a suggestion in an autocomplete textbox.
 * Mostly to be used for logging purposes after a suggestion is shown.
 */
export interface SuggestionInfo {
  id: string;
  timeShown: number;
  latency: number;
  suggestionText: string;
  leadingText: string;
  /**
   * Returns the full HTML of the textbox as a string.
   * Note that this includes the suggestion element itself.
   */
  getFullHTML: () => string;
};

export enum SuggestionRemovalReason {
  IMPLICIT = "implicit", // moved caret, input another character, blurred away from the textbox, etc.
  EXPLICIT = "pressed_escape",
  SYSTEM = "internal_reason" // e.g., when they accepted a suggestion, the suggstion is moved to the main text and then removed
};

export interface SuggestionRejectedInfo {
  suggestionId: string;
  timeRejected: number;
  reason: SuggestionRemovalReason;
};

export interface SuggestionAcceptedInfo {
  suggestionId: string;
  timeAccepted: number;
};

/**
 * A function that retrieves suggestions based on user input.
 * Usually, this will be some sort of API call to a language model.
 * 
 * Since typing is such a fast/dynamic activity, sometimes you may want to abort
 * the suggestion retrieval if the user has typed ahead and the suggestion from
 * the previous text is no longer relevant. In such cases, you can use the optional
 * `abortSignal` parameter and tha package will use it to abort the suggestion
 * retrieval if the user has typed ahead. This is an advanced feature but improves
 * the user experience.
 * 
 * Here's an example of how you might use this function. This example assumes that
 * you have an API endpoint that returns a suggestion based on the the text sent to it.
 * 
 * ```typescript
  const getSuggestion: GetSuggestionFn = async (textUptilNow: string, abortSignal?: AbortSignal): Promise<string> => {
    if (textUptilNow === "") return "";

    const response = await fetch('YOUR_API_ENDPOINT', {
      method: 'POST',
      body: JSON.stringify({ textUptilNow }),
      signal: abortSignal
    });

    const suggestion = (await response.json()).suggestion;
    return suggestion;
  };
 ```
 * 
 * 
 * @param textUptilCaret - The text up to the caret position.
 * @param abortSignal - An optional AbortSignal object that can be used to abort the suggestion retrieval.
 * @returns A string or a Promise that resolves to a string representing the suggestion.
 */
export type GetSuggestionFn = (textUptilCaret: string, abortSignal?: AbortSignal) => string | Promise<string>;