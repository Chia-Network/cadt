import React from 'react';
import { useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import styled, { withTheme } from 'styled-components';

import { MagnifyGlassIcon } from '../icons';

const Input = styled('input')`
  border: 1px solid
    ${props =>
      props.theme.hexToRgba(
        props.theme.colors[props.selectedTheme].onSurface,
        0.2,
      )};
  color: ${props => props.theme.colors[props.selectedTheme].onSurface};
  transition: box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  background-color: transparent;
  display: flex;
  justify-content: center;
  border-radius: 0.25rem;
  padding: 0.625rem;
  font-size: 1rem;
  padding-right: 1.875rem;
  margin: 0;

  &:focus {
    outline: ${props => props.theme.colors[props.selectedTheme].onSurface} solid
      0.0625rem;
  }

  &::placeholder {
    font-weight: bold;
    color: ${props =>
      props.theme.hexToRgba(
        props.theme.colors[props.selectedTheme].onSurface,
        0.25,
      )};
  }
`;

const SearchIconContainer = styled('div')`
  position: absolute;
  top: 0.625rem;
  right: -0.9375rem;
`;

const SearchInputField = withTheme(({ onChange }) => {
  const intl = useIntl();
  const appStore = useSelector(state => state.app);

  return (
    <div style={{ position: 'relative', maxWidth: '217px' }}>
      <Input
        type="text"
        selectedTheme={appStore.theme}
        placeholder={intl.formatMessage({ id: 'search' })}
        onChange={onChange}
      />
      <SearchIconContainer>
        <MagnifyGlassIcon />
      </SearchIconContainer>
    </div>
  );
});

export { SearchInputField };
