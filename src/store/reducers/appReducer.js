const initialState = {
  placeholderValue: 'THIS STRING WAS LOADED FROM THE STORE!',
  showProgressOverlay: false,
};

const appReducer = (state = initialState, action) => {
  switch (action.type) {
    default:
      return state;
  }
};

export {appReducer};
