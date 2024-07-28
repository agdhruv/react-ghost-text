import React from "react";
import assert from "assert";
import Suggestion from "./Suggestion";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Checks if the caret is at the end of a line in a contenteditable div.
 * Mainly used to determine if a suggestion should be shown to the user or not.
 * 
 * @param selection - The current selection object.
 * @param textbox - The contenteditable div.
 * @returns A boolean indicating whether the caret is at the end of a line.
 */
export const isCaretAtLineEnd = (
  selection: Selection,
  textbox: Readonly<HTMLDivElement>
): boolean => {
  let currentNode = selection.anchorNode; // The node where the caret is
  if (!currentNode) return false;

  /*
  In a contenteditable div, there are four possibilities (seen empirically):
  1. Node is a text node:
   1.1 Direct child of contenteditable div
   1.2 Not a direct child (maybe within div, bold, italic, etc. tags)
  2. Node is not a text node:
   2.1 It's the textbox itself (div)
   2.2 Direct child of contenteditable div
   2.3 Not a direct child of contenteditable div (corner case: enable bold at the end of a sentence and then press enter)
  */
  if (currentNode.nodeType === Node.TEXT_NODE) {

    // If this text node itself has text to the right of it, simple! The caret is not at the end.
    const offset = selection.anchorOffset;
    if (currentNode.textContent && currentNode.textContent.length > offset) {
      return false;
    }

    /* If the caret is at the end of the current text node, we still can't be sure if there's no text after it,
    because this it may be nested and there may be a sibling to the right. For example:
    - <div><b><i>text</i></b>more text</div>
    - text<b>more text</b> (can only happen on the first line)
    */
    if (currentNode.parentElement === textbox) {
      return true; // Caret is at the end of the first line of the textbox
    } else {
      const closestDiv = currentNode.parentElement?.closest("div");
      assert(closestDiv);

      if (closestDiv === textbox) {
        // Corner case: In the first line, if the user enables bold, then the closest div is the textbox itself but
        // we're sure the caret is at the end (if it's not, it would've already been caught by the offset check above)
        return true;
      }

      // Find which child of the closest div contains the text node
      const children = closestDiv?.childNodes;
      assert(children) // No children found in closest div (can't happen because our current node is a known child of the div)
      const childWithNode = Array.from(children).find(child => child.contains(currentNode));
      assert(childWithNode) // No child found that contains the text node (can't happen for the same reason as above)

      // Check if there is a sibling to the right and if it has text
      const nextSibling = childWithNode.nextSibling;
      if (nextSibling && nextSibling.textContent !== "") {
        return false;
      }
    }
    return true;
  } else { // Usually when the caret is at the beginning of a new line
    if (currentNode === textbox) {
      return true; // Caret is at the beginning of the textbox (also the end)
    } else if (currentNode.parentElement === textbox) {
      return true; // Caret is at the beginning of a new line
    } else {
      return true; // Caret is at the beginning of a new line but there's some formatting applied
    }
  }
};

/**
 * Generates a suggestion element for the AutocompleteTextbox component.
 * 
 * @param text - The text to be displayed in the suggestion element.
 * @returns The generated suggestion element.
 */
export const generateSuggestionElement = (
  text: string,
  suggestionId: string,
  className: string | undefined,
  style: React.CSSProperties | undefined
): Element => {
  const suggestionTSX = <Suggestion text={text} suggestionId={suggestionId} className={className} style={style} />;
  const suggestionHTMLString = renderToStaticMarkup(suggestionTSX);
  const suggestionElement = new DOMParser().parseFromString(suggestionHTMLString, "text/html").body.firstElementChild;
  assert(suggestionElement);
  return suggestionElement;
};

/**
 * Retrieves the current caret position as a Range object.
 * @returns The caret position as a Range object, or null if the caret is not available or not collapsed.
 */
export const getCaretAsRange = (): Range | null => {
  let selection = window.getSelection();
  if (!selection || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  return range;
};

/**
 * Retrieves the text in an HTMLDivElement up until the current caret position.
 * Assumes that the range is within the given element.
 * 
 * @param element - The HTMLDivElement to retrieve the text from.
 * @returns The text up until the current caret position.
 */
export const getTextUptilCaretInElement = (element: HTMLDivElement): string => {
  const range = getCaretAsRange();
  if (!range) return "";

  // Logic: create a new range from the start of the element to the current caret position
  // and get the text in that range. But this ignores newlines, so we need to do some extra work:
  // 1. Clone the contents of the range into a div
  // 2. Replace <br> with \n
  // 3. Get the innerText of the div
  try {
    range.setStart(element, 0);
  } catch (e) {
    console.error("Error setting range start:", e);
    return "";
  }

  // Create a div and clone the contents of the range into it
  const div = document.createElement("div");
  div.appendChild(range.cloneContents());
  range.collapse(false); // else the browser selects the text on the screen

  // Then replace element ending and <br> with \n and get the innerText of the div
  // This is a little hacky, could be improved but it works for now.
  div.innerHTML = div.innerHTML.replace(/<\/div><div>/g, "\n");
  div.innerHTML = div.innerHTML.replace(/<br>/g, "\n");
  let textUptilCaret = div.innerText;
  // Replace nbsp with regular space – easier for OpenAI to understand
  textUptilCaret = textUptilCaret.replace(/\xa0/g, " ");

  return textUptilCaret;
};

/**
 * Inserts a node at the current caret position in the document.
 * 
 * @param nodeToInsert - The node to be inserted.
 * @param textbox - The contentEditable div in which the node should be guaranteed to be inserted.
 * @param caretToStart - Should the caret should be moved to the start of the inserted node?
 * @param replacePrevNbspWithSpace - Should nbsp be replaced with regular spaces in the text node before the caret?
 * @returns A boolean indicating whether the node was successfully inserted.
 */
export const insertNodeAtCaret = (
  nodeToInsert: Node,
  textbox: HTMLDivElement,
  caretToStart: boolean,
  replacePrevNbspWithSpace = false
): boolean => {
  const range = getCaretAsRange();
  if (!range) return false;
  if (!textbox.contains(range.startContainer)) return false; // Corner case when the user clicks outside the textbox before the suggestion has been displayed
  range.insertNode(nodeToInsert);

  // This is very niche, but if the text node before the caret contains nbsp, replace it with a space
  // This helps mimic normal HTML behaviour where an nbsp shows up only if its the last character in the text node.
  if (replacePrevNbspWithSpace) {
    const clonedRange = range.cloneRange();
    const textNode = clonedRange.startContainer;
    if (textNode.textContent && textNode.nodeType === Node.TEXT_NODE) {
      textNode.textContent = textNode.textContent.replace(/\u00A0/g, ' ');
    }
  }

  range.collapse(caretToStart);
  return true;
};

export const isMobileBrowser = (window: any): boolean => {
  const navigator = window.navigator;
  // From: https://stackoverflow.com/a/11381730/5107216
  let check = false;
  (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
  return check;
};