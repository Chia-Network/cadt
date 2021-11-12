import React from 'react';
import styled, {withTheme} from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {Select, MenuItem} from '@mui/material';
import {LocaleIcon} from '../../components';
import {LANGUAGE_CODES} from '../../translations';
import {setLocale} from '../../store/actions/app';

const Container = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;

  .MuiSelect-root,
  .MuiSvgIcon-root {
    color: ${props => props.theme.colors[props.selectedTheme].onSurface};
  }
`;

const LocaleSwitcher = withTheme(() => {
  const dispatch = useDispatch();
  const appStore = useSelector(state => state.app);

  const handleLocaleChange = event => {
    dispatch(setLocale(event.target.value));
  };

  return (
    <Container selectedTheme={appStore.theme}>
      <LocaleIcon style={{marginRight: '10px'}} />
      <Select
        disableUnderline
        variant="standard"
        value={appStore.locale}
        onChange={handleLocaleChange}>
        {Object.keys(LANGUAGE_CODES).map(key => (
          <MenuItem key={LANGUAGE_CODES[key]} value={LANGUAGE_CODES[key]}>
            {key}
          </MenuItem>
        ))}
      </Select>
    </Container>
  );
});

export {LocaleSwitcher};
