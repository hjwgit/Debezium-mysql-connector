module.exports.functionReturn = function (promise, callback) {
  if (typeof callback === 'function') {
    // console.log('callBack');
    return promise.then(function (data) {
      callback(null, data);
      return null;
    }).catch(callback);
  } else { //FIXME should check whether promise is instanceof Promise
    return promise;
  }
};
