# react-ghost-text

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

React component to show ghost text suggestions in an input field (similar to VS Code or Gmail Smart Compose). Key features:
- Displays auto-complete suggestions when the user pauses typing
- Press `tab` to autocomplete (accept a suggestion)
- Press `escape` to reject a suggestion
- Caches and re-uses suggestions to avoid unnecessary calls to expensive AI services
- Typescript support for a good developer experience

![demo](https://github.com/agdhruv/react-ghost-text/blob/main/assets/demo.gif?raw=true)

Scroll [down](#live-examples) for the live demo.

## Install

```sh
npm install react-ghost-text
```

## Usage
```typescript
import { AutocompleteTextbox } from 'react-ghost-text';
```

```typescript
export default function Home() {

  // State to store the content of the textbox
  const [content, setContent] = useState<string>("");

  const getSuggestion = async (precedingText: string) => {
    // Fetch suggestion from a backend API (which may call GPT, Gemini, Claude, etc.)
    return "suggestion";
  };

  return (
    <AutocompleteTextbox
      getSuggestion={getSuggestion}
      onContentChange={content => setContent(content)} />
  )
}
```

## Available Props

### Required Props
|Prop|Description|Type|
|-|-|-|
|`getSuggestion`| A function that retrieves suggestions based on user input. Usually, this will be an API call to an AI service (e.g., OpenAI or Claude API). | function |

### Optional Props
|Prop|Description|Type|
|-|-|-|
| `value` | Initial value of the textbox. | string |
| `debounceTime` | The time to wait after the user stops typing before fetching a suggestion (in ms). Default: `1000`. | integer |
| `suggestionClassName` | The CSS class name for the span element that contains the suggestion. This is useful for styling the suggestion. Your className will override the default class name. Default: `suggestion`. | string |
| `suggestionStyle` | The inline style for the span element that contains the suggestion. This is useful for styling the suggestion. Your style will override the default style. Default: `{'color':'grey'}`.| object |
| `disableAutocomplete` | Disable autocomplete suggestions for the component. Default: `false` | boolean |
| `disabled` | Disable editing in the component (unlike the above, this disables the textbox itself, not the suggestions). Default: `false` | boolean |
| `onSuggestionShown` | An optional callback function that is called after a suggestion has been shown. | function |
| `onSuggestionAccepted` | An optional callback function that is called when a suggestion is accepted. | function |
| `onSuggestionRejected` | An optional callback function that is called when a suggestion is rejected. | function |
| `onContentChange` | An optional callback function that is called when the content of the textbox changes. It is called with the current content of the textbox (as HTML string). Note: This does not include the suggestion, only the main text input by the user. | function |
| Standard `div` props | This component accepts all standard HTML `div` attributes. This allows you to customize experience (e.g., disable paste by defining `onPaste`). | |

## Live Examples
- [Basic example](https://codesandbox.io/p/sandbox/basic-5lp855): Renders a basic textbox with inline autocomplete.
- [Advanced example](https://codesandbox.io/p/sandbox/advanced-example-6ght78): Renders a textbox with inline autocomplete and shows how to use some of the optional props.