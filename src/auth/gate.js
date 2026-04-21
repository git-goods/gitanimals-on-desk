"use strict";

const tokenStore = require("./token-store");

function shouldShowLogin() {
  return !tokenStore.get();
}

module.exports = { shouldShowLogin };
