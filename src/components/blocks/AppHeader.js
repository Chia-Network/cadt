import React from 'react';
import styled, { withTheme } from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { FormattedMessage } from 'react-intl';

import constants from '../../constants';
import { toggleTheme } from '../../store/actions/app';
import {
  H1,
  ChiaLogo,
  LightThemeIcon,
  DarkThemeIcon,
  LocaleSwitcher,
} from '../../components';

const AppHeaderContainer = styled('header')`
  width: 100%;
  height: ${constants.HEADER_HEIGHT}px;
  background-color: ${props => props.theme.colors[props.selectedTheme].surface};
  box-shadow: rgb(0 0 0 / 20%) 0px 0px 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const LogoContainer = styled('div')`
  width: 6.1875rem;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const ThemeSwitchContainer = styled('div')`
  padding: 0 3.125rem;
`;

const AppOptionsContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const AppHeader = withTheme(() => {
  const dispatch = useDispatch();
  const appStore = useSelector(state => state.app);

  const handleThemeSwitch = () => {
    dispatch(toggleTheme);
  };

  return (
    <AppHeaderContainer selectedTheme={appStore.theme}>
      <LogoContainer>
        <ChiaLogo width={65} height={25} />
      </LogoContainer>
      <H1>
        <FormattedMessage id="app-title" />
      </H1>
      <AppOptionsContainer>
        <LocaleSwitcher />
        <ThemeSwitchContainer onClick={handleThemeSwitch}>
          {appStore.theme === constants.THEME.DARK ? (
            <LightThemeIcon cursor="pointer" />
          ) : (
            <DarkThemeIcon cursor="pointer" />
          )}
        </ThemeSwitchContainer>
      </AppOptionsContainer>
    </AppHeaderContainer>
  );
});

export { AppHeader };
