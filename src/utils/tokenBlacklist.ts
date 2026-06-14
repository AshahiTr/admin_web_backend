interface TokenBlacklist {
  [key: string]: number; // token: expiryTime
}

const blacklist: TokenBlacklist = {};

export const addTokenToBlacklist = (token: string, expiryTime: number) => {
  blacklist[token] = expiryTime;
};

export const isTokenBlacklisted = (token: string): boolean => {
  if (!blacklist[token]) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > blacklist[token]) {
    delete blacklist[token];
    return false;
  }

  return true;
};

// Clean up expired tokens every 10 minutes
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const token in blacklist) {
    if (now > blacklist[token]) {
      delete blacklist[token];
    }
  }
}, 10 * 60 * 1000);
