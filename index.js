var express = require('express')
  , app = express()
  , router = require('express').Router()
  , validURL = require('valid-url');

// Root directory.
global.__base = __dirname;

// Configs.
var config = require('config');
console.log(config);

// Port
app.set('port', process.env.PORT || config.get('port') || 3000);

// MySQL.
var mysql = require('mysql');
var mysqlc = mysql.createConnection({
  host: config.get('mysql.host'),
  user: config.get('mysql.user'),
  password: config.get('mysql.password'),
  database: config.get('mysql.database')
});
mysqlc.connect(function (err) {
  if (err) {
    throw err;
  }
  console.log('You are now connected to MySQL...')
});

/**
 * ShortURL: Bijective conversion between natural numbers (IDs) and short strings
 *
 * ShortURL.encode() takes an ID and turns it into a short string
 * ShortURL.decode() takes a short string and turns it into an ID
 *
 * Features:
 * + large alphabet (51 chars) and thus very short resulting strings
 * + proof against offensive words (removed 'a', 'e', 'i', 'o' and 'u')
 * + unambiguous (removed 'I', 'l', '1', 'O' and '0')
 *
 * Example output:
 * 123456789 <=> pgK8p
 */
var ShortURL = new function (alphabet) {
  var _alphabet = config.get('alphabet')
    , _base = _alphabet.length;

  /**
   * Encode.
   *
   * @param num
   * @returns {string}
   */
  this.encode = function (num) {
    var str = '';
    while (num > 0) {
      str = _alphabet.charAt(num % _base) + str;
      num = Math.floor(num / _base);
    }
    return str;
  };

  /**
   * Decode.
   *
   * @param str
   * @returns {number}
   */
  this.decode = function (str) {
    var num = 0;
    for (var i = 0; i < str.length; i++) {
      num = num * _base + _alphabet.indexOf(str.charAt(i));
    }
    return num;
  };

};

/**
 * Listen.
 */
app.use(function (req, res, next) {
  var hash, url, id;
  var table = config.get('mysql.table');

  /**
   *
   * @param id
   */
  var reqSendHash = function (id) {
    // Hash.
    hash = ShortURL.encode(id);

    // Return.
    res.status(200);
    res.send(config.get('domain') + '/' + hash);
  };

  /**
   *
   */
  var reqSendError = function () {
    // Return.
    res.status(500);
    res.send("'" + url + "' resulted in error.");
  };

  // Parse URL.
  var query = require('url').parse(req.url, true).query;

  /**
   * Encode.
   */
  if (!!query.q) {
    url = query.q;

    if (validURL.isUri(url)) {
      // Query.
      mysqlc.query('SELECT id FROM ' + table + ' WHERE url = ? LIMIT 1', [url], function (error, results, fields) {
        if (error) {
          reqSendError();
        }
        else {
          if (results.length > 0) {
            reqSendHash(results[0].id);
          }
          else {
            mysqlc.query('INSERT INTO ' + table + ' SET ?', {url: url}, function (error, results, fields) {
              if (error) {
                reqSendError();
              }
              else {
                reqSendHash(results.insertId);
              }
            });
          }
        }
      });
    }
    else {
      // Return.
      res.status(500);
      res.send("'" + url + "' is not a valid URL.");
    }
  }

  /**
   * Decode.
   */
  else {
    // Hash.
    hash = req.path.substr(1);

    // ID.
    id = ShortURL.decode(hash);

    // Validate.
    if (!id) {
      reqSendError();
      return;
    }

    // Query.
    mysqlc.query('SELECT url FROM ' + table + ' WHERE id = ? LIMIT 1', [id], function (error, results, fields) {
      if (error) {
        reqSendError();
      }
      else {
        res.redirect(results[0].url);
      }
    });
  }
});

// Init.
app.listen(app.get('port'), function () {
  console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});


