/*jslint nodejs: true */

// required modules
var db = require('db'),
    querystring = require('querystring'),
    request = require('request'),
    url = require('url');

/**
 * A thin Node.js wrapper for Google Glass applications running under Express
 *
 * @class glass
 */
module.exports = {

    // ===================================================================
    // === Setup -========================================================
    // ===================================================================

    /**
     * options being used
     * @var Object
     * @property options
     */
    options: {
        apiKey          : undefined,
        clientId        : undefined,
        clientSecret    : undefined,
        callbackUri     : undefined,
        scopes          : ['https://www.googleapis.com/auth/glass.timeline'],
        authUri         : 'https://accounts.google.com/o/oauth2/auth',
        tokenUri        : 'https://accounts.google.com/o/oauth2/token',
        userInfoUri     : 'https://www.googleapis.com/oauth2/v1/userinfo'
    },
    
    /**
     * configure google application
     *
     * @method configure
     * @param {Object} options
     */
    configure: function(options){

        var delegate = this;

        if (options.apiKey !== undefined && options.clientId !== undefined && options.clientSecret !== undefined && options.callbackUri !== undefined){

            this.options.apiKey         = options.apiKey;
            this.options.clientId       = options.clientId;
            this.options.clientSecret   = options.clientSecret;
            this.options.callbackUri    = options.callbackUri;

        } else {

            throw new Error('Minimum configuration options not satisified (apiKey, clientId, clientSecret, callbackUri)');

        }

        if (options.scopes !== undefined && Array.isArray(options.scopes)){

            options.scopes.forEach(function(scope){

                if (!/glass\.timeline/.test(scope)){
                    delegate.options.scopes.push(scope);
                }

            });

        }

    },

    /**
     * generate auth uri for this google application
     *
     * @param void
     * @return {String}
     */
    generateAuthUri: function(){

        return this.options.authUri +
            '?response_type=code' +
            '&client_id=' + this.options.clientId +
            '&redirect_uri=' + this.options.callbackUri +
            '&scope=' + encodeURIComponent(this.options.scopes.join(' ')) +
            '&state=default' +
            '&access_type=offline' +
            '&approval_prompt=auto';

    },

    /**
     * get user profile information
     *
     * @method getUserProfile
     * @param {String} accessToken
     * @param {Function} callback(err, result)
     */
    getUserProfile: function(accessToken, callback){

        var url = this.options.userInfoUri +
            '?alt=json' +
            '&access_token=' + accessToken;

        request.get(url, function(err, res, profile){

            callback(err, JSON.parse(profile));

        });

    },

    /**
     * connect session to google application
     *
     * note: fire this method from your "install/authorize" express route
     *
     * @method connect
     * @param {Object} req
     * @param {Object} res
     * @param {Function} callback
     */
    connect: function(req, res, callback){

        if (!req.session.code){

            // get connected
            res.redirect(this.generateAuthUri());

        } else {

            // connected
            callback(undefined);

        }

    },

    /**
     * remember session connection to google application
     *
     * note: fire this method from your "callbackUri" route
     *
     * @method remember
     * @param {Object} req
     * @param {Object} res
     * @param {Function} callback(err)
     */
    remember: function(req, res, callback){
        console.log('remember()');

        var delegate = this;

        var query = url.parse(req.url, true).query;
        console.log('query', query);

        if (query.code !== undefined){

            // prepare token request
            var options = {
                uri  : this.options.tokenUri,
                form : {
                    code            : query.code,
                    client_id       : this.options.clientId,
                    client_secret   : this.options.clientSecret,
                    redirect_uri    : this.options.callbackUri,
                    grant_type      : 'authorization_code'
                },
                json : true
            };
            console.log('post options', options);

            // auth succeeded, get tokens
            request.post(options, function(err, res, tokens){

                if (!err){

                    console.log('no errors, remembering tokens', tokens);

                    // get user profile
                    delegate.getUserProfile(tokens.access_token, function(err, profile){

                        if (!err){

                            // session memory
                            req.session.code    = query.code;
                            req.session.profile = profile;
                            req.session.tokens  = tokens;

                            // compute token expiration
                            var expires = new Date();
                            expires.setSeconds(expires.getSeconds() + parseInt(tokens.expires_in));

                            // build a token record
                            var record = {
                                code          : query.code,
                                profile       : profile,
                                access_token  : tokens.access_token,
                                refresh_token : tokens.refresh_token,
                                expires       : expires
                            };

                            // database memory
                            db.insert('tokens', record, function(err, result){

                                // finish
                                console.log('tokens saved to db', err, result);
                                callback(err);

                            });

                        } else {

                            callback(err);

                        }

                    });

                } else {

                    // post failed
                    console.log('post failed');
                    callback(err);

                }

            });

        } else {

            // authentication failed
            console.log('auth failed');
            callback('Authentication failed');

        }

    },

    /**
     * reconnect session to google application
     *
     * @method reconnect
     * @param {String} authCode
     * @param {Function} callback(err)
     */
    reconnect: function(authCode, callback){

        // get user id
        // use user id to find access token
        // confirm that access token has not expired
        // if access token has expired use refresh token to get a new access token
        // save new access token
        // carry on

    }

};

