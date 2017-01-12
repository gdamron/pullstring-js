/*
 * Encapsulate a conversation thread for PullString's Web API.
 *
 * Copyright (c) 2016 PullString, Inc.
 *
 * The following source code is licensed under the MIT license.
 * See the LICENSE file, or https://opensource.org/licenses/MIT.
 */

import {Response, Status} from './Response.js';
import {RestClient} from './RestClient.js';
import {Request} from './Request.js';
import {Speech} from './Speech.js';
import {VersionInfo} from './VersionInfo.js';

/**
 * The Conversation class can be used to interface with the PullString API.
 *
 * To begin a conversation, call the start() method, providing a PullString
 * project ID and a Request object specifying you API key.
 *
 * The Web API returns a Response object that can contain zero or more outputs,
 * such as lines of dialog or behaviors. This Response object is passed to the
 * onResponse callback as its sole parameter.
 *
 * @property {string} ApiBaseUrl
 * @property {Number} AsrSampleRate
 * @property {Number} AsrChannels
 */
class Conversation {
    /**
     * Creates a Conversation
     * @param {XMLHttpReqeuest} [nodeXhr = null] If in Node.js, pass in the
     * XMLHttpReqeuest module class.
     */
    constructor(nodeXhr = null) {
        /**
         * @callback Conversation~onResponse
         */
        this.onResponse = null;
        let config = { baseUrl: VersionInfo.ApiBaseUrl };
        if (nodeXhr) config.xhr = nodeXhr;
        this._client = new RestClient(config);
        this._speech = new Speech();
        this._request = null;
    }

    /**
     * Start a new conversation with the Web API and receive a reponse via the
     * onResponse callback.
     * @param {string} projectName The PullString project ID.
     * @param {Request} request A Request object with a valid apiKey value
     * specified.
     * @param {string} request.apiKey Your API key.
     */
    start(projectName, request) {
        if (!this._ensureRequest(request)) return;

        let json = {
            project: projectName,
        };

        if (request.hasOwnProperty('timeZoneOffset')) {
            json.time_zone_offset = request.timeZoneOffset; // eslint-disable-line camelcase
        }

        this._post(json, request);
    }

    /**
     * Send user input text to the Web API and receive a response via the
     * onResponse callback.
     * @param {string} text User input text.
     * @param {Request} request A request object with at least apiKey and
     * conversationId set.
     * @param {string} request.apiKey Your API key.
     * @param {string} request.conversationId The conversation ID received when
     * the conversation was started.
     */
    sendText(text, request) {
        let json = {
            text: text,
        };

        this._post(json, request);
    }

    /**
     * Send an activity name or ID to the Web API and receive a response via
     * the onResponse callback.
     * @param {string} activity The activity name or ID.
     * @param {Request} request A request object with at least apiKey and
     * conversationId set.
     */
    sendActivity(activity, request) {
        let json = {
            activity: activity,
        };

        this._post(json, request);
    }

    /**
     * Send an event to the Web API and receive a response via the onResponse
     * callback.
     * @param {string} event The event name.
     * @param {Object} parameters Any accompanying parameters.
     * @param {Request} request A request object with at least apiKey and
     * conversationId set.
     */
    sendEvent(event, parameters, request) {
        let eventObj = {
            name: event,
            parameters: parameters || {},
        };

        let json = {
            event: eventObj,
        };

        this._post(json, request);
    }

    /**
     * Initiate a progressive (chunked) streaming of audio data, where supported.
     *
     * Note, chunked streaming is not currently implemented, so this will batch
     * up all audio and send it all at once when end_audio() is called.
     * @param {Request} request A request object with at least apiKey and
     * conversationId set.
     */
    startAudio(request) {
        if (this._ensureRequest(request)) this._speech.start();
    }

    /**
     * Add a chunk of audio. You must call start_audio() first. The format of
     * the audio must be mono LinearPCM audio data at a sample rate of 16000
     * samples per second.
     * @param {Float32Array} buffer The audio data, i.e. from
     * `audioBuffer.getChannelData(0)`.
     */
    addAudio(buffer) {
        this._speech.add(buffer);
    }

    /**
     * Signal that all audio has been provided via add_audio() calls. This will
     * complete the audio request and return the Web API response.
     */
    stopAudio() {
        let _this = this;
        this._speech.getBytes((data) => {
            _this._speech.flush();
            _this._postAudio(
                data,
                _this._request
            );
        });
    }

    /**
     * Send an entire audio sample of the user speaking to the Web API. Audio
     * must be raw, mono 16-bit linear PCM at a sample rate of 16000
     * samples per second.
     * @param {DataView} audio Mono 16-bit linear PCM audio data at 16k Hz.
     * @param {Request.EAudioFormat} format Specify WAV or raw PCM format. Note
     * that only 16-bit linear PCM WAV format at 16k is currently supported.
     * @param {Request} request A request object with at least apiKey and
     * conversationId set.
     * */
    sendAudio(audio, format, request) {
        if (Object.prototype.toString.call(audio) !== '[object DataView]') {
            this._returnError('Audio sent to sendAudio is not a DataView');
            return;
        }

        if (format !== Request.EAudioFormat.Wav16k) {
            this._returnError('Unsupported format sent to sendAudio.');
            return;
        }

        let audioData = this._getWavData(audio);

        if (audioData.error) {
            this._returnError(audioData.error);
            return;
        }

        this._postAudio(audioData, request);
    }

    /**
     * Jump the conversation directly to a response.
     * @param {string} responseId The UUID of the response to jump to.
     * @param {Request} request A request object with at least apiKey and
     * conversationId set.
     */
    goTo(responseId, request) {
        let json = {
            goto: responseId,
        };

        this._post(json, request);
    }

    /**
     * Call the Web API to see if there is a time-based response to process. You
     * only need to call this if the previous response returned a value for the
     * timedResponseInterval >= 0.  In this case, set a timer for that value (in
     * seconds) and then call this method. If there is no time-based response,
     * the onResponse callback will be passed an empty Response object.
     * @param {Request} request A request object with at least apiKey and
     * conversationId set.
     */
    checkForTimedResponse(request) {
        let json = {/* empty json */};
        this._post(json, request);
    }

    /**
     * Request the values of the specified entities (i.e.: labels, counters, flags,
     * and lists) from the Web API.
     * @param {string[]} entities An array of entity names.
     * @param {Request} request A request object with at least apiKey and
     * conversationId set.
     */
    getEntities(entities, request) {
        if (!Array.isArray(entities)) {
            this._returnError('entities sent to getEntities must be an array');
            return;
        }

        let json = {
            get_entities: entities, // eslint-disable-line camelcase
        };

        this._post(json, request);
    }

    /**
     * Change the value of the specified entities (i.e.: labels, counters, flags,
     * and lists) via the Web API.
     * @param {Object[]} entities An array specifying the entities to set and
     * their new values.
     * @param {string} entities[].name The entity's name.
     * @param {*} entities[].value The entity's name, which can be any type.
     * @param {Request} request A request object with at least apiKey and
     * conversationId set.
     */
    setEntities(entities, request) {
        if (!Array.isArray(entities)) {
            this._returnError('entities sent to setEntities must be an array');
            return;
        }

        let entObj = {};
        for (let i in entities) {
            let entity = entities[i];
            entObj[entity.name] = entity.value;
        }

        let json = {
            set_entities: entObj, // eslint-disable-line camelcase
        };

        this._post(json, request);
    }

    /**
     * Retrieve the current conversation ID. Conversation IDs can persist across
     * sessions, if desired.
     * @return {string} The concurrent conversation ID.
     */
    getConversationId() {
        if (this._request && this._request.conversationId) {
            return this._request.conversationId;
        }

        return null;
    }

    /**
     * Get the current participant ID, which identifies the current state for
     * clients. This can persist across sessions, if desired.
     * @return {string} The current participant ID.
     */
    getParticipantId() {
        if (this._request && this._request.participantId) {
            return this._request.participantId;
        }

        return null;
    }

    _ensureRequest(request) {
        if (request) {
            this._request = request;
        }

        if (!this._request || !this._request.apiKey) {
            this._returnError('Valid request object missing');
            return false;
        }

        return true;
    }

    _post(body, request, contentType = 'application/json', doEncode = true) {
        if (!this._ensureRequest(request)) return;
        let endpoint = this._endpointForRequest(this._request);
        let headers = this._headersForRequest(this._request, contentType);
        let params = this._paramsForRequest(this._request);

        // If doEncode is true, our body is json. So add more params from request.
        if (doEncode) {
            body = this._bodyForRequest(this._request, body);
        }

        this._client.post(
            endpoint,
            params,
            headers,
            body,
            (response) => this._responseHandler(response),
            doEncode
        );
    }

    _postAudio(audio, request) {
        if (!audio) {
            this._returnError('Unable to extract audio data');
            return;
        }

        this._post(audio, this._request, 'audio/l16; rate=16000', false);
    }

    _headersForRequest(request, contentType) {
        let headers = {
            Authorization: `Bearer ${request.apiKey}`,
            Accept: 'application/json',
        };

        headers['Content-Type'] = contentType;

        return headers;
    }

    _paramsForRequest(request) {
        let params = {
            asr_language: request.language, // eslint-disable-line camelcase
        };

        if (request.locale) params.locale = request.locale;
        if (request.acountId) params.account = request.accountId;

        return params;
    }

    _bodyForRequest(request, params = null) {
        let body = {};

        // only add build_type and restart_if_modified if not the default values
        if (request.buildType !== Request.EBuildType.Production) {
            body.build_type = request.buildType; // eslint-disable-line camelcase
        }

        if (request.restartIfModified === false) {
            body.restart_if_modified = false; // eslint-disable-line camelcase
        }

        if (request.participantId) body.participant = request.participantId;

        if (params) {
            for (let p in params) {
                body[p] = params[p];
            }
        }

        return body;
    }

    _endpointForRequest(request) {
        let endpoint = 'conversation';

        if (request.conversationId) {
            endpoint = `${endpoint}/${request.conversationId}`;
        }

        return endpoint;
    }

    _responseHandler(json) {
        let response = new Response(json);
        if (response.status.success && this._request) {
            this._request.conversationId = response.conversationId;
            this._request.participantId = response.participantId;
        }
        this.onResponse && this.onResponse(response);
    }

    _getWavData(dataView) {
        let riff = this._dataViewGetString(dataView, 0, 4);

        if (riff !== 'RIFF') {
            return { error: 'Data is not a WAV file' };
        }

        let channels = dataView.getUint16(22, true);
        let rate = dataView.getUint32(24, true);
        let bitsPerSample = dataView.getUint16(34, true);

        if (channels !== 1 || rate !== 16000 || bitsPerSample !== 16) {
            return { error: 'WAV data is not mono 16-bit data at 16k sample rate' };
        }

        let dataOffset = 12;
        let chunkSize = dataView.getUint32(16, true);
        let fileSize = dataView.getUint32(4, true);

        while (this._dataViewGetString(dataView, dataOffset, 4) !== 'data') {
            if (dataOffset > fileSize) {
                return { error: 'Cannot find data segment in WAV file' };
            }

            dataOffset += chunkSize + 8;
            chunkSize = dataView.getUint32(dataOffset + 4, true);
        }

        let dataStart = dataOffset + 8;
        let buffer = dataView.buffer.slice(dataStart);
        return new Uint8Array(buffer);
    }

    _dataViewGetString(dataView, offset, length) {
        let retVal = '';
        for (let i = 0; i < length; i++) {
            let charCode = dataView.getUint8(i + offset);
            retVal = retVal + String.fromCharCode(charCode);
        }

        return retVal;
    }

    _returnError(message) {
        let error = new Status({
            success: false,
            message: message,
            code: 500,
        });

        this.onResponse && this.onResponse({
            status: error,
        });
    }
}

// static constants
Object.defineProperty(Conversation, 'AsrSampleRate', {
    value: 16000,
    writable: false,
    enumerable: true,
    configurable: false,
});

Object.defineProperty(Conversation, 'AsrChannels', {
    value: 1,
    writable: false,
    enumerable: true,
    configurable: false,
});

module.exports = { Conversation };
