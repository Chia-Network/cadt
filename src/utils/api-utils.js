export const redirectWithDefaultPagination = (req, res) => {
  let redirectUrl = `${req.baseUrl}?page=1&limit=10`;

  if (Object.keys(req.query).length > 0) {
    redirectUrl = redirectUrl.concat(
      '&',
      Object.keys(req.query)
        .map((key) => `${key}=${req.query[key]}`)
        .join('&'),
    );
  }

  // Redirect to the modified URL
  return res.redirect(301, redirectUrl);
};
