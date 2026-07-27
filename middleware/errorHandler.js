function notFound(req, res) {
  res.status(404).render('404', {
    title: 'Page Not Found',
    metaDescription: 'The requested page could not be found.'
  });
}

function errorHandler(error, req, res, next) {
  console.error(error);
  const status = error.statusCode || error.status || 500;
  const message = status === 500 ? 'Something went wrong. Please try again.' : error.message;
  res.status(status).render('error', {
    title: 'Website Error',
    metaDescription: 'An error occurred.',
    message
  });
}

module.exports = { notFound, errorHandler };
