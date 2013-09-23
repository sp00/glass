/*jslint nodejs: true */

// required modules
var async = require('async'),
    db = require('db'),
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

            this.confirm(req, res, callback);

            // connected
            //callback(undefined);

        }

    },

    /**
     * confirm session to google application is still valid
     *
     * @method confirm
     * @param {Object} req
     * @param {Object} res
     * @param {Function} callback
     */
    confirm: function(req, res, callback){

        // perform a get
        this.getLocations(req, function(err, locations){

            //confirm test:locations { error: 'invalid_grant' }
            console.log('confirm test:err', err);
            console.log('confirm test:locations', locations);
            console.log('locations type', typeof locations);

            // end of test, continue connect
            callback(undefined);

        });

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
     * @param {String} refreshToken
     * @param {String} accessToken
     * @param {Function} callback(err)
     */
    updateToken: function(refreshToken, accessToken, callback){

        // save to database
        db.query('tokens', { refresh_token: refreshToken }, function(err, tokens){

            if (!err){

                var token = tokens[0];
                token.access_token = accessToken;

                db.update('tokens', { _id: token._id }, token, function(err){

                    callback(err);

                });

            } else {

                callback(err);

            }

        });

    },

    /**
     * perform a request (and refresh access token if necessary)
     *
     * @param {Object} req
     * @param {Object} options
     * @param {Function} callback
     * @param {Boolean} refresh (default=false)
     */
    request: function(req, options, callback, refresh){

        var delegate = this;

        request(options, function(err, res, body){

            if (/^\s*\{/.test(body)){
                body = JSON.parse(body);
            }

            if (!err && typeof body !== 'string' && body.error !== undefined && body.error.message !== undefined){

                err = body.error.message;

            } else if (typeof body === 'string' && body === 'Invalid Credentials'){

                err = body;

            }

            if (err === 'Invalid Credentials'){

                if (refresh){

                    // we only attempt to refresh once
                    callback(err, res, body);

                } else {

                    // refresh token
                    var refreshOptions = {
                        url : delegate.options.tokenUri,
                        form : {
                            client_id     : delegate.options.clientId,
                            client_secret : delegate.options.clientSecret,
                            refresh_token : req.session.tokens.refresh_token,
                            grant_type    : 'refresh_token'
                        },
                        json : true
                    };

                    request.post(refreshOptions, function(err, res, body){

                        if (body.access_token !== undefined) {

                            // save new access token to session
                            req.session.tokens.access_token = body.access_token;

                            // save refreshed access token
                            delegate.updateToken(req.session.tokens.refresh_token, body.access_token, function(err){

                                if (!err){

                                    // try again
                                    delegate.request(req, options, callback, true);

                                } else {

                                    // failed again
                                    callback(err, res, body);

                                }

                            });

                        } else {

                            callback(err, res, body);

                        }

                    });

                }

            } else {

                callback(err, res, body);

            }

        });

    },

    /**
     * perform a get request
     *
     * @param {Object} req
     * @param {Object} options
     * @param {Function} callback
     */
    get: function(req, options, callback){

        options.method = 'GET';
        this.request(req, options, callback);

    },

    /**
     * perform a post request
     *
     * @param {Object} req
     * @param {Object} options
     * @param {Function} callback
     */
    post: function(req, options, callback){

        options.method = 'POST';
        this.request(req, options, callback);

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
     * @param {Function} callback(err, contact)
     */
    insertContact: function(req, contact, callback){

        if (!this.isValidContact(contact)){

            callback('Invalid contact provided');

        } else {

            var options = {
                url     : 'https://www.googleapis.com/mirror/v1/contacts',
                headers : { Authorization: 'Bearer ' + req.session.tokens.access_token },
                json    : contact
            };

            this.post(req, options, function(err, res, body){

                callback(err, body);

            });

        }

    },
    
    // ===================================================================
    // === Items =========================================================
    // ===================================================================

    /**
     * insert a new timeline item
     *
     * @method insertItem
     * @param {Object} req
     * @param {Object} item
     * @param {Function} callback(err, item)
     */
    insertItem: function(req, item, callback){

        if (!this.isValidItem(item)){

            callback('Invalid item provided');

        } else {

            var options = {
                url     : 'https://www.googleapis.com/mirror/v1/timeline',
                headers : { Authorization: 'Bearer ' + req.session.tokens.access_token },
                json    : item
            };

            this.post(req, options, function(err, res, body){

                callback(err, body);

            });

        }

    },
    
    /**
     * get existing timeline item 
     *
     * @method getItem
     * @param {Object} req
     * @param {String} itemId
     * @param {Function} callback(err, item)
     */
    getItem: function(req, itemId, callback){

        var options = {
            url     : 'https://www.googleapis.com/mirror/v1/timeline/' + itemId,
            headers : { Authorization: 'Bearer ' + req.session.tokens.access_token }
        };

        this.get(req, options, function(err, res, body){

            callback(err, body);

        });

    },

    // ===================================================================
    // === Bundles =======================================================
    // ===================================================================

    /**
     * insert a new timeline bundle
     *
     * Note: The first item in the items array will be set as the bundle cover.
     *
     * @param {Object} req
     * @param {String} bundleId
     * @param {Array} items
     * @param {Function} callback(err, result)
     */
    insertBundleItems: function(req, bundleId, items, callback){

        var delegate = this;
        var callbacks = [];
        var isBundleCover = true;
        var bundleTime = new Date();
        var orderId = 0;
        var stepDelay = 5; // ms

        items.forEach(function(item){

            item.bundleId = bundleId;
            item.isBundleCover = isBundleCover;

            if (isBundleCover){

                isBundleCover = false;

            } else {

                var displayTime = new Date(bundleTime);
                displayTime.setSeconds(bundleTime.getSeconds() + (items.length - orderId));
                item.displayTime = displayTime;

            }

            callbacks.push(function(callback){

                setTimeout(function(){

                    // @todo: account for how to handle attachments
                    delegate.insertItem(req, item, callback);

                }, stepDelay * orderId);

            });

            orderId++;

        });

        async.series(callbacks, callback);

    },

    // ===================================================================
    // === Attachments ===================================================
    // ===================================================================

    /**
     * get existing timeline item attachment
     *
     * @method getAttachment
     * @param {Object} req
     * @param {String} itemId
     * @param {String} attachmentId
     * @param {Function} callback(err, attachment)
     */
    getAttachment: function(req, itemId, attachmentId, callback){

        var options = {
            url     : 'https://www.googleapis.com/mirror/v1/timeline/' + itemId + '/attachments/' + attachmentId,
            headers : { Authorization: 'Bearer ' + req.session.tokens.access_token }
        };

        this.get(req, options, function(err, res, body){

            callback(err, body);

        });

    },

    /**
     * get existing timeline item attachment as raw image data
     *
     * @method getAttachmentImage
     * @param {Object} req
     * @param {String} itemId
     * @param {String} attachmentId
     * @param {Function} callback(err, attachment, image)
     */
    getAttachmentImage: function(req, itemId, attachmentId, callback){

        var delegate = this;

        this.getAttachment(req, itemId, attachmentId, function(err, attachment){

            if (!err){

                var options = {
                    url      : attachment.contentUrl,
                    encoding : 'binary',
                    headers  : {
                        Authorization : 'Bearer ' + req.session.tokens.access_token
                    }
                };

                delegate.get(req, options, function(err, res, body){

                    callback(err, attachment, body);

                });
                
            } else {

                callback(err, attachment);

            }

        });

    },

    // ===================================================================
    // === Locations =====================================================
    // ===================================================================

    /**
     * get list of timeline locations
     *
     * @method getLocations
     * @param {Object} req
     * @param {Function} callback(err, locations)
     */
    getLocations: function(req, callback){

        var options = {
            url     : 'https://www.googleapis.com/mirror/v1/locations',
            headers : { Authorization: 'Bearer ' + req.session.tokens.access_token }
        };

        this.get(req, options, function(err, res, body){

            callback(err, body);

        });

    },

    // ===================================================================
    // === Subscriptions =================================================
    // ===================================================================

    /**
     * insert a new timeline subscription
     *
     * @method insertSubscription
     * @param {Object} req
     * @param {Object} subscription
     * @param {Function} callback(err, subscription)
     */
    insertSubscription: function(req, subscription, callback){

        if (!this.isValidSubscription(subscription)){

            callback('Invalid subscription provided');

        } else {

            var options = {
                url     : 'https://www.googleapis.com/mirror/v1/subscriptions',
                headers : { Authorization: 'Bearer ' + req.session.tokens.access_token },
                json    : subscription
            };

            this.post(req, options, function(err, res, body){

                callback(err, body);

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

    },

    /**
     * determine if item object is valid
     *
     * {
     *     kind          : "mirror#timelineItem",
     *     id            : string,
     *     sourceItemId  : string,
     *     canonicalUrl  : string,
     *     bundleId      : string,
     *     isBundleCover : boolean,
     *     selfLink      : string,
     *     created       : datetime,
     *     updated       : datetime,
     *     displayTime   : datetime,
     *     isPinned      : boolean,
     *     pinScore      : integer,
     *     isDeleted     : boolean,
     *     etag          : etag,
     *     creator       : contacts Resource,
     *     recipients    : [
     *         contacts Resource
     *     ],
     *     inReplyTo     : string,
     *     title         : string,
     *     text          : string,
     *     html          : string,
     *     htmlPages     : [
     *         string
     *     ],
     *     speakableType : string,
     *     speakableText : string,
     *     attachments   : [
     *         timeline.attachments Resource
     *     ],
     *     location      : locations Resource,
     *     menuItems     : [
     *         {
     *             id                 : string,
     *             action             : string,
     *             values             : [
     *                 {
     *                     state       : string,
     *                     displayName : string,
     *                     iconUrl     : string
     *                 }
     *             ],
     *             removeWhenSelected : boolean,
     *             payload            : string
     *         }
     *     ],
     *     notification  : {
     *         level        : string,
     *         deliveryTime : datetime
     *     }
     * }
     * 
     * @method isValidItem
     * @param {Object} item
     * @param {Boolean} existing (default=false)
     * @return {Boolean}
     */
    isValidItem: function(item, existing){

        return true;

    },

    /**
     * determine if subscription object is valid
     *
     * {
     *     kind         : "mirror#subscription",
     *     id           : string,
     *     updated      : datetime,
     *     collection   : string,
     *     operation    : [
     *         string
     *     ],
     *     callbackUrl  : string,
     *     verifyToken  : string,
     *     userToken    : string,
     *     notification : {
     *         collection  : string,
     *         itemId      : string,
     *         operation   : string,
     *         userActions : [
     *             {
     *                 type    : string,
     *                 payload : string
     *             }
     *         ],
     *         verifyToken : string,
     *         userToken   : string
     *     }
     * }
     * 
     * @method isValidSubscription
     * @param {Object} subscription
     * @param {Boolean} existing (default=false)
     * @return {Boolean}
     */
    isValidSubscription: function(subscription, existing){

        if (subscription.callbackUrl === undefined || typeof subscription.callbackUrl !== 'string'){
            return false;
        }

        if (subscription.collection === undefined || typeof subscription.collection !== 'string'){
            return false;
        }

        return true;

    },

};

