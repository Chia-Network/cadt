import React from 'react';
import logo from './logo.svg';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import './App.css';

const Home = () => {
  const appStore = useSelector(state => state.app);
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FormattedMessage id="hello-world" />
          <div>{appStore.placeholderValue}</div>
        </a>
      </header>
    </div>
  );
};

export {Home};
