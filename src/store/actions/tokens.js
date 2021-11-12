import _ from 'lodash';
import {keyMirror} from '../store-functions';
import constants from '../../constants';

import {
  activateProgressIndicator,
  deactivateProgressIndicator,
  setGlobalErrorMessage,
} from './app';

import {mockedRetiredTokenResponse} from '../../mocks';

export const actions = keyMirror('GET_RETIRED_TOKENS');

const mockedTokenResponse = {
  type: actions.GET_RETIRED_TOKENS,
  // Different envs import this differently
  payload: _.get(
    mockedRetiredTokenResponse,
    'default',
    mockedRetiredTokenResponse,
  ),
};

export const getRetiredTokens = ({useMockedResponse = false}) => {
  return async dispatch => {
    try {
      dispatch(activateProgressIndicator);

      if (useMockedResponse) {
        dispatch(mockedTokenResponse);
      } else {
        const response = fetch(`${constants.API_HOST}/tokens`);

        if (response.ok) {
          const results = await response.json();
          dispatch({
            type: actions.GET_RETIRED_TOKENS,
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
