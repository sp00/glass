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
        tokenUri        : 'https://accounts.google.com/o/oauth2/token'
    },
    
    /**
     * tokens being used
     * @var Object
     * @property tokens
     */
    tokens: {
        accessToken  : undefined,
        refreshToken : undefined
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

        var query = url.parse(req.url, true).query;

        if (query.code !== undefined){

            // auth succeeded, get tokens
            request.post({

                uri  : this.options.tokenUri,
                form : {
                    code            : query.code,
                    client_id       : this.options.clientId,
                    client_secret   : this.options.clientSecret,
                    redirect_uri    : this.options.callbackUri,
                    grant_type      : 'authorization_code'
                },
                json : true

            }, function(err, tokens){

                if (!err){

                    // remember
                    req.session.code   = query.code;
                    req.session.tokens = tokens;

                }

                // finish
                callback(undefined);

            });

        } else {

            // authentication failed
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

    },

    // ===================================================================
    // === Contacts ======================================================
    // ===================================================================

    /**
     * insert new timeline contact
     *
     * @method insertContact
     * @param {Object} contact
     * @param {Function} callback(err, result)
     */
    insertContact: function(contact, callback){
        callback('not implemented', null);
    },

    /**
     * get existing timeline contact 
     *
     * @method getContact
     * @param {String} contactId
     * @param {Function} callback(err, contact)
     */
    getContact: function(contactId, callback){
        callback('not implemented', null);
    },

    /**
     * update existing timeline contact
     *
     * @method updateContact
     * @param {Object} contact
     * @param {Function} callback(err, result)
     */
    updateContact: function(contact, callback){
        callback('not implemented', null);
    },

    /**
     * remove existing timeline contact
     *
     * @method removeContact
     * @param {String} contactId
     * @param {Function} callback(err)
     */
    removeContact: function(contactId, callback){
        callback('not implemented', null);
    },

    /**
     * list all timeline contacts
     *
     * @method listContacts
     * @param {Function} callback(err, contacts)
     */
    listContacts: function(callback){
        callback('not implemented', null);
    },

    // ===================================================================
    // === Locations =====================================================
    // ===================================================================

    /**
     * get existing timeline location 
     *
     * @method getLocation
     * @param {String} locationId
     * @param {Function} callback(err, location)
     */
    getLocation: function(locationId, callback){
        callback('not implemented', null);
    },

    /**
     * list all timeline locations
     *
     * @method listLocations
     * @param {Function} callback(err, locations)
     */
    listLocations: function(callback){
        callback('not implemented', null);
    },

    // ===================================================================
    // === Subscriptions =================================================
    // ===================================================================

    /**
     * insert new timeline subscription
     *
     * @method insertSubscription
     * @param {Object} subscription
     * @param {Function} callback(err, result)
     */
    insertSubscription: function(subscription, callback){
        callback('not implemented', null);
    },

    /**
     * get existing timeline subscription 
     *
     * @method getSubscription
     * @param {String} subscriptionId
     * @param {Function} callback(err, subscription)
     */
    getSubscription: function(subscriptionId, callback){
        callback('not implemented', null);
    },

    /**
     * update existing timeline subscription
     *
     * @method updateSubscription
     * @param {Object} subscription
     * @param {Function} callback(err, result)
     */
    updateSubscription: function(subscription, callback){
        callback('not implemented', null);
    },

    /**
     * remove existing timeline subscription
     *
     * @method removeSubscription
     * @param {String} subscriptionId
     * @param {Function} callback(err)
     */
    removeSubscription: function(subscriptionId, callback){
        callback('not implemented', null);
    },

    /**
     * list all timeline subscriptions
     *
     * @method listSubscriptions
     * @param {Function} callback(err, subscriptions)
     */
    listSubscriptions: function(callback){
        callback('not implemented', null);
    },

    // ===================================================================
    // === Timeline Items ================================================
    // ===================================================================

    /**
     * insert new timeline item
     *
     * @method insertItem
     * @param {Object} item
     * @param {Function} callback(err, result)
     */
    insertItem: function(item, callback){
        callback('not implemented', null);
    },

    /**
     * get existing timeline item 
     *
     * @method getItem
     * @param {String} itemId
     * @param {Function} callback(err, item)
     */
    getItem: function(itemId, callback){
        callback('not implemented', null);
    },

    /**
     * update existing timeline item
     *
     * @method updateItem
     * @param {Object} item
     * @param {Function} callback(err, result)
     */
    updateItem: function(item, callback){
        callback('not implemented', null);
    },

    /**
     * remove existing timeline item
     *
     * @method removeItem
     * @param {String} itemId
     * @param {Function} callback(err)
     */
    removeItem: function(itemId, callback){
        callback('not implemented', null);
    },

    /**
     * list all timeline items
     *
     * @method listItems
     * @param {Function} callback(err, items)
     */
    listItems: function(callback){
        callback('not implemented', null);
    },

    // ===================================================================
    // === Timeline Item Attachments =====================================
    // ===================================================================

    /**
     * insert new timeline item attachment
     *
     * @method insertAttachment
     * @param {String} itemId
     * @param {Object} attachment
     * @param {Function} callback(err, result)
     */
    insertAttachment: function(itemId, attachment, callback){
        callback('not implemented', null);
    },

    /**
     * get existing timeline item attachment
     *
     * @method getAttachment
     * @param {String} itemId
     * @param {String} attachmentId
     * @param {Function} callback(err, attachment)
     */
    getAttachment: function(itemId, attachmentId, callback){
        callback('not implemented', null);
    },

    /**
     * update existing timeline item attachment
     *
     * @method updateAttachment
     * @param {String} itemId
     * @param {Object} attachment
     * @param {Function} callback(err, result)
     */
    updateAttachment: function(itemId, attachment, callback){
        callback('not implemented', null);
    },

    /**
     * remove existing timeline item attachment
     *
     * @method removeAttachment
     * @param {String} itemId
     * @param {String} attachmentId
     * @param {Function} callback(err)
     */
    removeAttachment: function(itemId, attachmentId, callback){
        callback('not implemented', null);
    },

    /**
     * list all timeline item attachments
     *
     * @method listAttachments
     * @param {String} itemId
     * @param {Function} callback(err, attachments)
     */
    listAttachments: function(itemId, callback){
        callback('not implemented', null);
    },

    // ===================================================================
    // === Timeline Item Bundles =========================================
    // ===================================================================

    /**
     * insert new timeline bundle
     *
     * @method insertBundle
     * @param {Array} items
     * @param {Function} callback(err, result)
     */
    insertBundle: function(items, callback){
        callback('not implemented', null);
    },

    /**
     * get existing timeline bundle 
     *
     * @method getBundle
     * @param {String} bundleId
     * @param {Function} callback(err, contact)
     */
    getBundle: function(bundleId, callback){
        callback('not implemented', null);
    },

    /**
     * update existing timeline bundle
     *
     * @method updateBundle
     * @param {String} bundleId
     * @param {Array} items
     * @param {Function} callback(err, result)
     */
    updateBundle: function(bundleId, items, callback){
        callback('not implemented', null);
    },

    /**
     * remove existing timeline bundle
     *
     * @method removeBundle
     * @param {String} bundleId
     * @param {Function} callback(err)
     */
    removeBundle: function(bundleId, callback){
        callback('not implemented', null);
    },

    /**
     * list all timeline bundles
     *
     * @method listBundles
     * @param {Function} callback(err, contacts)
     */
    listBundles: function(callback){
        callback('not implemented', null);
    },

    // ===================================================================
    // === Validation Routines ===========================================
    // ===================================================================

    /**
     * determine if is valid contact
     *
     * @method isValidContact
     * @param {Object} contact
     * @param {Boolean} existing (optional, default=false)
     * @return {Boolean}
     */
    isValidContact: function(contact, existing){
    },

};

