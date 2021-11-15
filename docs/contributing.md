This SPA React Architecture that this project adopted aims for rapid development and contribution to the project in a predictable way. While there are a lot of competing mindsets in how a react application should be architected, this architecture has proven to be robust and allow for rapid development across a variety of use cases.

## Key Concepts:

- Organizes the project in predictable and semantically correct way.
- Provides easy access to Global App State
- Includes Theme Engine
- Supports multiple languages to be hot swapped via its language engine

## Application Structure

The top level application structure is as follows:

- components - this is where the custom component library should live
- constants - constants files shall be exported from this directory
- mocks - json files that returned mocked responses to endpoints
- navigation - this is where the app router should reside
- pages - the application pages, each page should get its own folder
- store - home to actions/reducers/initial state
- translations - includes the translation files for the app
- utils - any application utilities and helpers
- theme.js - the theme file that is used across the app

## Components

The components folder holds the reusable components for the application. While the structure in this folder is fluid. Its been found that the following folders are generally useful for most projects:

#### Component Sub-Folders

- form - holds form related components
- layout - layout based components example: grids, Spacers etc..
- typography - H1, H2, H3 and any other typography that sets up the standard font, sizes line-heights etc, for the app. All typography for the app should be defined in this folder. Not text should appear in the app that doesnt use a component defined here.
- icons - library of SVG icons that are used in the app. Please dont import SVG files directly into the app, instead pull the SVG into a component. This allows props such as width, height, color that can control the SVG.
- blocks - Application specific reusable components, example: AppHeader, AppFooter, DataTable, Footer etc…

Feel free to add other subfolders if necessary

## Themes and styling

We use the styled-components library to assign css-like styles to components. Generally CSS should only be written within the component folder to build our components. We try to keep our ‘Page Views’ in the pages folder css-free and only compose these components within the page view.

The theme itself uses the Material color system defined by google. More about it can be read here. https://material.io/design/color/the-color-system.html#tools-for-picking-colors

The theme file supports both a light theme and a dark theme.

The color system is as follows:

```
interface ColorSystem {
   // The color displayed most frequently across the app screens
  primary: string;
  primaryVarient: string;
  // Secondary color provides more ways to accent and distinguish the app
  secondary: string;
  secondaryVarient: string;
  // appears behind scrollable content
  background: string;
  // affect surfaces of componennts such as cards sheets and menus
  surface: string;
  // indicates errors in components
  error: string;
  errorVarient: string;
  //"On" colors
  // App surfaces use colors from specific categories in your color palette,
  // such as a primary color. Whenever elements, such as text or icons, appear in
  // front of those surfaces, those elements should use colors designed to be clear
  // and legible against the colors behind them.
  //
  // This category of colors is called "on" colors, referring to the fact that
  // they color elements that appear "on" top of surfaces that use the following
  // colors: a primary color, secondary color, surface color, background color,
  // or error color. When a color appears "on" top of a primary color, it's called
  // an "on primary color." They are labelled using the original color category
  //(such as primary color) with the prefix "on."
  //
  // "On" colors are primarily applied to text, iconography, and strokes.
  // Sometimes, they are applied to surfaces.
  onPrimary: string;
  onSecondary: string;
  onBackground: string;
  onSurface: string;
  onError: string;
}
```

To apply a theme to a component you import the withTheme HOC from the styled-components module

```
import {withTheme} from 'styled-components';
```

Once this HOC is applied to a component it injects the theme prop that can be accessed.

#### Determining if light or dark theme is used

The theme selected is held in the redux ‘App Store' under the key 'theme’.

You can use a the react hook `useSelector` to retrieve it. In any react component use the following to get the theme selection:

```
const {theme} = useSelector(state => state.app);
```

#### Putting it all together

Together with the `withTheme` HOC and the selected theme, you can build components that are follow the color system and instantly display the theme that is selected. The example is a simple H1 component that does this:

```
const Text = styled('h1')`
  color: ${props => props.theme.colors[props.selectedTheme].onSurface};
  font-size: 1.5rem;
  font-family: ${props => props.theme.typography.primary};
  font-weight: 400;
  line-height: 1.334;
  letter-spacing: 0em;
`;

const H1 = withTheme(({children, color}) => {
  const appStore = useSelector(state => state.app);
  return (
    <Text color={color} selectedTheme={appStore.theme}>
      {children}
    </Text>
  );
});

export {H1};
```

## App Navigation

The app navigation folder exports the AppRouter that routes pages for the app. Because the AppRouter is a top level component in which all the pages are mounted within, A secondary use for the App router is to mount global components that need to appear on every page. Examples include Header components or modals that appear above the page when activated.

Here is an example component that shows all this:

```
const AppNavigator = () => {
  const {showProgressOverlay} = useSelector(store => store.app);
  return (
    <AppContainer>
      { /* The AppHeader needs to show above every page */ }
      <AppHeader />
      <Router>
        { /* Conditionally show the activity indicator component above all pages
             if its activated in the store. */
          showProgressOverlay && <IndeterminateProgressOverlay />
        }
        { /* mount all the pages in the router below */ }
        <Suspense fallback={<IndeterminateProgressOverlay />}>
          <Route exact path="/">
            <Pages.Home />
          </Route>
        </Suspense>
      </Router>
    </AppContainer>
  );
};

export {AppNavigator};
```

## Store and Actions

We use unidirectional data flow utilizing a modern ‘Redux’ design to control app state. Redux was chosen because it is one of the most known state systems for developers. The modern redux hooks to create a easy to use state system.

Unlike older iterations of Redux that require concepts of “smart components/dumb components” and prop drilling state. We assume that any component can be smart. A smart component is simply a component that can pull data from the store.

This can be done using a simple `useSelector` hook.

```
import {useSelector} from 'react-redux';

const MyComponent= ({children}) => {
  const appStore = useSelector(state => state.app);

  return (
    <div>
      {appStore.bar}
    </div>
  );
});

export {MyComponent};
```

Also dispatching an action is simple to, there are 2 parts to dispatching an action

1. import the useDispatch hook
2. import the action to be dispatched

```
import {useDispatch} from 'react-redux';
import {setButtonAsClicked} from '../store/actions/app';

const MyComponent= ({children}) => {
  const dispatch = useDispatch();

  const handleButtonClick = () => {
    dispatch(setButtonAsClicked);
  }

  return (
    <button onClick={handleButtonClick} />
  );
});

export {MyComponent};
```

```
NOTE: if you call the action directly without dispatching it, it will not get invoked.
```

### Actions and Reducers

Actions are used to manipulate state either synchronously or asynchronously. To create an action first you need to create an Action key for the action. We use an internal utility called keyMirror for this.

Here is a full example for a file containing various types of synchronouse actions:

```
import {keyMirror} from '../store-functions';
import {LANGUAGE_CODES} from '../../translations';

export const actions = keyMirror(
  'ACTIVATE_PROGRESS_INDICATOR',
  'DEACTIVATE_PROGRESS_INDICATOR',
  'TOGGLE_THEME',
  'SET_THEME',
  'SET_GLOBAL_ERROR_MESSAGE',
  'CLEAR_GLOBAL_ERROR_MESSAGE',
  'SET_LOCALE',
);

export const activateProgressIndicator = {
  type: actions.ACTIVATE_PROGRESS_INDICATOR,
};

export const deactivateProgressIndicator = {
  type: actions.DEACTIVATE_PROGRESS_INDICATOR,
};

export const setThemeFromLocalStorage = {
  type: actions.SET_THEME,
  payload: localStorage.getItem('theme'),
};

export const toggleTheme = {
  type: actions.TOGGLE_THEME,
};

export const setGlobalErrorMessage = message => ({
  type: actions.SET_GLOBAL_ERROR_MESSAGE,
  payload: message,
});

export const clearGlobalErrorMessage = {
  type: actions.CLEAR_GLOBAL_ERROR_MESSAGE,
};

export const setLocale = locale => {
  let localeToSet = locale;

  // Default to en-US if language isnt supported
  if (
    !Object.keys(LANGUAGE_CODES)
      .map(key => LANGUAGE_CODES[key])
      .includes(locale)
  ) {
    localeToSet = 'en-US';
  }

  return {
    type: actions.SET_LOCALE,
    payload: localeToSet,
  };
};
```

Reducers are used to modify state when an action is dispatched:

```
import u from 'updeep';

import {actions as appActions} from '../actions/app';
import constants from '../../constants';

const initialState = {
  showProgressOverlay: false,
  theme: constants.THEME.DARK,
  errorMessage: null,
  locale: null,
};

const appReducer = (state = initialState, action) => {
  switch (action.type) {
    case appActions.ACTIVATE_PROGRESS_INDICATOR:
      return u({showProgressOverlay: true}, state);

    case appActions.DEACTIVATE_PROGRESS_INDICATOR:
      return u({showProgressOverlay: false}, state);

    case appActions.SET_GLOBAL_ERROR_MESSAGE:
      return u({errorMessage: action.payload}, state);

    case appActions.CLEAR_GLOBAL_ERROR_MESSAGE:
      return u({errorMessage: null}, state);

    case appActions.SET_LOCALE:
      return u({locale: action.payload}, state);

    case appActions.SET_THEME:
      if (
        action.payload === constants.THEME.LIGHT ||
        action.payload === constants.THEME.DARK
      ) {
        return u({theme: action.payload}, state);
      }
      return state;

    case appActions.TOGGLE_THEME:
      // eslint-disable-next-line
      const theme =
        state.theme === constants.THEME.DARK
          ? constants.THEME.LIGHT
          : constants.THEME.DARK;
      localStorage.setItem('theme', theme);
      return u({theme}, state);
    default:
      return state;
  }
};

export {appReducer};

```

```
Notice the use of updeep to modify the state. While the system allows for any method to modify state, we believe that updeep is the cleanest method. It allows you to update deeply nested data pretty cleanly. More information can be found here: npm: https://www.npmjs.com/package/updeep
```

#### Example Action file with Asynchronous API call:

```
import _ from 'lodash';
import {keyMirror} from '../store-functions';
import constants from '../../constants';

import {
  activateProgressIndicator,
  deactivateProgressIndicator,
  setGlobalErrorMessage,
} from './app';

import {mockedDataResponse} from '../../mocks';

export const actions = keyMirror('GET_DATA');

const mockedResponse = {
  type: actions.GET_DATA,
  // Different envs import this differently
  payload: _.get(
    mockedDataResponse,
    'default',
    mockedDataResponse,
  ),
};

export const getData = ({useMockedResponse = false}) => {
  return async dispatch => {
    dispatch(activateProgressIndicator);

    try {
      if (useMockedResponse) {
        dispatch(mockedTokenResponse);
      } else {
        const response = fetch(`${constants.API_HOST}/data`);

        if (response.ok) {
          const results = await response.json();
          dispatch({
            type: actions.GET_DATA,
            payload: results,
          });
        }
      }
    } catch {
      dispatch(setGlobalErrorMessage('Something went wrong...'));
    } finally {
      dispatch(deactivateProgressIndicator);
    }
  };
};

```

## Translations

We use Format.js as the translation engine. This works by defining translation files in JSON files and setting up the app to use the correct JSON for the language desired. The language files should be named the standard language abbreviation that the browser would use when requesting the language

Example JSON files:

- en-US.JSON - US english

```
{
  "hello-world": "Hello World",
  "app-title": "Super Cool App",
}
```

- es.JSON - Spanish

```
{
  "hello-world": "Hola Mundo",
  "app-title": "Aplicación Super Cool",
}
```

- ja.JSON - Japanese

```
{
  "hello-world": "こんにちは世界",
  "app-title": "超クールなアプリ",
}
```

```
NOTE: If a specific language file that is requested from the browser isn't specified, the system just defaults to the English-US language file.
```

There are 2 ways to display these translations in the app.

1. The first way is to use the FormatMessage component within JSX:

```
import {FormatMessage} from 'react-intl';

const MyComponent = () => {
  return (
    <div>
      <FormatMessage id="hello-world" />
    </div>
  );
}

export {MyComponent}
```

2. The second way, to display a translation outside of JSX your need to use the imperative method. To do this, import the useIntl hook.

```
import {useIntl} from 'react-intl';

const MyComponent = () => {
  const intl = useIntl();

  const translatedMessage = intl.formatMessage({id: 'hello-world'})

  return (
    <div>
      {translatedMessage}
    </div>
  );
}

export {MyComponent}
```

```
Note: you should never directly use text strings in the app, as these can not be translated. For all copy please create a translation token in the JSON file and use either method to display the copy and text in the app.
```

## Pages

The Pages folder is where each page is defined. To be considered a ‘Page’ it must be directly mounted to the App Router.

For example, if the following Router was defined:

```
 import * as Pages from '../pages';

 <Router>
   <Route exact path="/">
      <Pages.Home />
    </Route>
    <Route exact path="/contact">
      <Pages.Contact />
    </Route>
    <Route exact path="/profile">
      <Pages.Profile/>
    </Route>
  </Suspense>
</Router>
```

We would then expect the page folder to contain the following sub-folders

- pages
  - Contact
  - Home
  - profile

A special file in this folder is `pages/index.js` . In order to follow the import style in the example above, its important to import the pages in a specific way.

As an example, when we export the Home component, we do not `export default Home;` We instead use `export {Home};`

Here is an example:

```
const Home = () => {
  return (
    <div>
      This is the home page
    </div>
  );
};

export {Home};
```

This allows the following to be added in `pages/index.js`

`export * from './Home'`

This above is saying to export all the exported components in the Home directory as part of the `pages/index.js` export.

This allows use to then import any Page directly from the pages folder.

`import * as Pages from './Pages'` without having to do separate imports for each page subfolder.

Then the Home component is available through `Pages.Home`

```
Notice that the components folder has a similar exports pattern
```
