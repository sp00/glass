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
    // === Setup =========================================================
    // ===================================================================

    /**
     * options being used
     * @var Object
     * @property options
     */
    options: {
        apiKey           : undefined,
        clientId         : undefined,
        clientSecret     : undefined,
        callbackUri      : undefined,
        scopes           : [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/glass.timeline'
        ],
        authUri          : 'https://accounts.google.com/o/oauth2/auth',
        tokenUri         : 'https://accounts.google.com/o/oauth2/token',
        userInfoUri      : 'https://www.googleapis.com/oauth2/v1/userinfo',
        contactsUri      : 'https://www.googleapis.com/mirror/v1/contacts',
        itemsUri         : 'https://www.googleapis.com/mirror/v1/timeline',
        locationsUri     : 'https://www.googleapis.com/mirror/v1/locations',
        subscriptionsUri : 'https://www.googleapis.com/mirror/v1/subscriptions'
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

        var delegate = this;
        var query = url.parse(req.url, true).query;

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

            // auth succeeded, get tokens
            request.post(options, function(err, res, tokens){

                if (!err){

                    // get user profile
                    delegate.getUserProfile(tokens.access_token, function(err, profile){

                        if (!err){

                            // session memory
                            req.session.code    = query.code;
                            req.session.profile = profile;
                            req.session.tokens  = tokens;

                            // compute token expiration
                            var expires = new Date();
                            expires.setSeconds(expires.getSeconds() + parseInt(tokens.expires_in, 10));

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
                                callback(err);

                            });

                        } else {

                            callback(err);

                        }

                    });

                } else {

                    // post failed
                    callback(err);

                }

            });

        } else {

            // authentication failed
            callback('Authentication failed');

        }

    },

    /**
     * update access token
     *
     * @param {Object} req
     * @param {String} accessToken
     * @param {Function} callback(err)
     */
    updateAccessToken: function(req, accessToken, callback){

        // save to session
        req.session.tokens.access_token = accessToken;

        // save to database
        //db.update('tokens', { refresh_token: req.}, { access_token: accessToken }, function(err){

            //callback(err);

        //});
        //
        callback(undefined);

    },

    /**
     * perform a request post (and refresh access token if necessary)
     *
     * @param {Object} req
     * @param {Object} options
     * @param {Function} callback
     * @param {Boolean} refresh (default=false)
     */
    post: function(req, options, callback, refresh){

        var delegate = this;

        request.post(options, function(err, res, body){

            if (body === 'Invalid Credentials'){

                if (refresh){

                    // only attempt to refresh once
                    callback(err, res, body);

                } else {

                    request.post({ 
                        url : delegate.options.tokenUri,
                        form : {
                            client_id     : delegate.options.clientId,
                            client_secret : delegate.options.clientSecret,
                            refresh_token : req.session.tokens.refresh_token,
                            grant_type    : 'refresh_token'
                        }
                    }, function(err, res, body){

                        if (err){

                            // failed
                            callback(err, res, body);

                        } else {

                            // received refreshed tokens
                            var refreshedTokens = JSON.parse(body);

                            // save refreshed access token
                            delegate.updateAccessToken(req, refreshedTokens.access_token, function(err){

                                if (!err){

                                    // try again
                                    delegate.repost(req, options, callback, true);

                                } else {

                                    // failed again
                                    callback(err, res, body);

                                }

                            });

                        }

                    });

                }

            } else {

                // success
                callback(err, res, body);

            }

        });

    },

    // ===================================================================
    // === Users =========================================================
    // ===================================================================

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

    // ===================================================================
    // === Contacts ======================================================
    // ===================================================================

    /**
     * insert a new timeline contact
     *
     * @method insertContact
     * @param {Object} req
     * @param {Object} contact
     * @param {Function} callback(err)
     */
    insertContact: function(req, contact, callback){

        if (!this.isValidContact(contact)){

            callback('Invalid contact provided');

        } else {

            var options = {
                url     : 'https://www.googleapis.com/mirror/v1/contacts',
                headers : { Authorization: 'Bearer ' + req.session.tokens.access_token },
                form    : contact
            };

            this.post(req, options, function(err, res, body){

                callback(err);

            });

        }

    },
    
    // ===================================================================
    // === Validation Routines ===========================================
    // ===================================================================

    /**
     * determine if contact object is valid
     *
     * {
     *     kind           : "mirror#contact",
     *     source         : string,
     *     id             : string,
     *     displayName    : string,
     *     imageUrls      : [
     *         string
     *     ],
     *     type           : string,
     *     acceptTypes    : [
     *         string
     *     ],
     *     phoneNumber    : string,
     *     priority       : unsigned integer,
     *     acceptCommands : [
     *         {
     *             type : string
     *         }
     *     ],
     *     speakableName  : string
     * }
     * 
     * @method isValidContact
     * @param {Object} contact
     * @param {Boolean} existing (default=false)
     * @return {Boolean}
     */
    isValidContact: function(contact, existing){

        if (contact.id === undefined || typeof contact.id !== 'string'){
            return false;
        }

        if (contact.displayName === undefined || typeof contact.displayName !== 'string'){
            return false;
        }

        if (contact.imageUrls === undefined || !Array.isArray(contact.imageUrls) || contact.imageUrls.length === 0){
            return false;
        }

        return true;

    }

};

