import u from 'updeep';

import {actions as appActions} from '../actions/app';
import constants from '../../constants';

const initialState = {
  placeholderValue: 'THIS STRING WAS LOADED FROM THE STORE!',
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
