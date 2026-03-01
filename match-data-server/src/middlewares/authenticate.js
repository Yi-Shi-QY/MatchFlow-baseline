function createAuthenticateMiddleware(apiKey) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ error: { message: 'Missing or invalid authorization header' } });
    }

    const token = authHeader.split(' ')[1];
    if (token !== apiKey) {
      return res.status(401).json({ error: { message: 'Invalid API Key' } });
    }

    return next();
  };
}

module.exports = {
  createAuthenticateMiddleware,
};

