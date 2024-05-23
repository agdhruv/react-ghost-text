export interface AutocompleteTextboxProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * A function that retrieves suggestions based on user input.
   * Usually, this will be some sort of API call to a language model.
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

export type GetSuggestionFn = (textUptilCaret: string) => string | Promise<string>;