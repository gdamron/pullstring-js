/*
 * Control collection and processing of audio data for ASR.
 *
 * Copyright (c) 2016 PullString, Inc.
 *
 * The following source code is licensed under the MIT license.
 * See the LICENSE file, or https://opensource.org/licenses/MIT.
 */

import SpeechWorker from './SpeechWorker.js';

class Speech {
    constructor(client) {
        this._client = client;
        this._callback = null;
        this._worker = null;
    }

    start(endpoint, headers, params, callback) {
        this._endpoint = endpoint;
        this._headers = headers;
        this._params = params;
        this._onResponse = callback;

        let _this = this;
        this._worker = new Worker(this._getSpeechWorkerUrl());
        this._worker.onmessage = (message) => {
            _this._onResponse && _this._onResponse(message);
        };
    }

    add(audio) {
        let workerObj = {
            command: 'listen',
            buffer: audio,
        };
        this._worker.postMessage(workerObj, [workerObj.buffer.buffer]);
    }

    stop() {
        let _this = this;
        this.getBytes((data) => {
            _this.flush();

            _this._client.post(
                _this.endpoint,
                _this.params,
                _this.headers,
                data,
                _this.onResponse,
                false
            );

            _this.endpoint = null;
            _this.params = null;
            _this.headers = null;
        });
    }

    sendAudio(audio, endpoint, params, headers, callback) {
        if (Object.prototype.toString.call(audio) !== '[object DataView]') {
            return 'Audio sent to sendAudio is not a DataView';
        }

        let audioData = this._getWavData(audio);

        if (audioData.error) {
            return audioData.error;
        }

        this._client.post(
            endpoint,
            params,
            headers,
            audioData,
            callback,
            false
        );

        return null;
    }

    flush() {
        this._worker.postMessage({
            command: 'flush',
        });
    }

    getBytes(cb) {
        if (!cb) {
            throw new Error('Callback must be provide to process audio');
        }

        this._callback = (message) => {
            cb && cb(message.data);
        };
        this._worker.postMessage({
            command: 'getMono',
        });
    }

    _getSpeechWorkerUrl() {
        let createObjURL = (window.URL && URL.createObjectURL.bind(URL)) ||
            (window.webkitURL && window.webkitURL.createObjectURL.bind(window.webkitURL)) ||
            window.createObjectURL;

        if (!createObjURL) {
            createObjURL = global.createObjectURL;
        }

        let funcStr = SpeechWorker.toString();
        let bodyStart = funcStr.indexOf('{');
        let bodyEnd = funcStr.lastIndexOf('}');

        if (bodyStart > 0 && bodyEnd > bodyStart) {
            let speechWorkerFunc = funcStr.substring(bodyStart + 1, bodyEnd);
            return createObjURL(new Blob([speechWorkerFunc]), {type: 'text/javascript'});
        }

        return null;
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
}

module.exports = { Speech: Speech };
