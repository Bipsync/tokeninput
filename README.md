### Introducing tokeninput
Dependency-free Javascript UI component providing a token based input element with grouped completion lists and free-text entry

### Usage
Create an instance of the TokenInput class with two parameters:
- an instance of an Input DOM element
- a configuration object, to tailor the component to your needs

```html
<script src="tokeninput/tokeninput.js" />
<div id="tokeninput">
  <input placeholder="Type something…" />
</div>
```
```javascript
new TokenInput( document.getElementById( 'tokeninput' ), {} );
```

See [index.html](index.html) and [demo.js](demo.js) for examples.

There are lots of options, see [tokeninput.js](tokeninput.js)

### API

Method | Description
-------|------------
`addEventListener(element, type, listener)` | Adds an event listener to the given element.
`getTokens()` | Returns an array of objects representing each token added to the component.
`getSelectedCompletion()` | Returns the datum of the selected completion
`setSelectedCompletion(datum)` | Sets the selected completion
`getSelectedCompletionElement()` | Returns the element of the selected completion
`removeCompletions()` | Removes all the completions
`setTokens(newTokens)` | Removes all existing tokens from the UI and replaces them with the tokens in the given array.
`setCompletionGroups(completionGroups)` | Configures the completion groups that visually separate suggestions.
`removeFloatingElement()` | Hides the suggestion UI.
`removeToken(datum, options)` | Removes the given token from the component UI and the component's internal list of tokens.
`positionFloatingElement()` | Force the floating element to reposition
`setElementAfterCompletions(element)` | Set the element to place after completions
`setElementBeforeCompletions(element)` | Set the element to place before completions
`getScrollingContainer()` | Get the current scrolling container element
`onUp()` | Trigger the up key handler
`onDown()` | Trigger the down key handler
`destroy()` | Cleans up by removing all registered event listeners.

### Completions / suggestions

Use the following options to drive how completions are presented:

Option | Description
-|-
completionsForText|Function that receives the text, delayedCompletionsId and delayedCompletionsFn. Returns datums (objects) for each completion
completionClassNames|Function that receives a datum to determine it's class name
completionFormatter|Function that receives a datum and corresponding element for further customisation
completionGroupClassNames|Function that receives the completion group, returns an array of class names
completionGroupHeadingClassNames|Function that receives the completion group heading, returns an array of class names
completionGroups|Object of completion group definitions, see demo.js
newCompletionOption|Function that receives a group and returns the datum for the 'new' completion, defaults to "+ New (group.singular)"

### Other options

Option | Description | Default
-----|------------|---------
readOnly | Prevents tokens from being added / removed | `false`
tabToAdd | Pressing the tab key submits the current token and allows a new one to be entered | `true`
xHTML | A string which represents the delete button in a token | `&times;`
tokenClassNames | A function which is called for each added token. Should return an array of class names that will be added to the token HTML element. | `[]`
tokenFormatter | A function which is called for each added token. Can be used to customise the token element for display when not in inline mode | |
inlineTokenFormatter | A function which is called for each added token. Can be used to customise the token element for display when in inline mode | |
containerClickTriggersFocus | Determines if a click on the containing element will focus the tokeninput | true
freeTextEnabled | Determines whether the user is able to enter arbitrary tokens (`true`) or forced to select a pre-existing datum (`false`) | `false`
freeTextToken | A function that determines the makeup of a datum created via free-text |
freeTextCompletion | A function that determines the makeup of an object that represents free-text entry which is passwd to the suggestion handler |
willShowFreeTextCompletion | A function that determines whether or not to show the completion view for free-text |
inlineTokenTrigger | An object which defines logic for determining whether to show completion for typed text when in inline mode |
namespace | A string or function to namespace element class names | `null`
autoSelectSingleCompletions | Select the first and only completion automatically | `true`
positionFloatingElement | A function that is passed the floating element for manual positioning | `null`
floatingElementParent | An element to use as the floating elements parent node, defaults to the input elements parent node | `null`
removeOnlyCompletionsListElement | Set to true to only remove the list element rather than the whole floating element | `false`
beforeEnter | Pre-keypress event handler | `null`
beforeCompletionClick | Pre-click event handler | `null`
hintElement | An element to use as a hint container | `null`
scrollingContainerClassName | A selector for the scrolling container, by default the floating element is used | `null`
hintAfterAdd | Show the hint element after adding a token | `false`
disableTokenClick | Disable the build-in token click hander | `false`
disableFocusOnRemove | Disable the automatic behaviour that focuses the input element after removing a token | `false`
placeholderLength | Specify the placeholder length in characters | `null`
