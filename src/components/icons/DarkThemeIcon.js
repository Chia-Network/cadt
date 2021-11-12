import React from 'react';
import {useSelector} from 'react-redux';
import {withTheme} from 'styled-components';

const DarkThemeIcon = withTheme(
  ({width = 24, height = 24, theme, cursor = 'unset'}) => {
    const appStore = useSelector(state => state.app);

    return (
      <div style={{cursor}}>
        <svg
          width={`${width}px`}
          height={`${height}px`}
          focusable="false"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill={theme.colors[appStore.theme].onSurface}>
          <path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-.89 0-1.74-.2-2.5-.55C11.56 16.5 13 14.42 13 12s-1.44-4.5-3.5-5.45C10.26 6.2 11.11 6 12 6c3.31 0 6 2.69 6 6s-2.69 6-6 6z"></path>
        </svg>
      </div>
    );
  },
);

export {DarkThemeIcon};
