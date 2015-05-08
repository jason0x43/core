import registerSuite = require('intern!object');
import assert = require('intern/chai!assert');
import request, { Response, RequestOptions } from 'src/request';
import { default as nodeRequest } from 'src/request/node';
import { default as xhrRequest } from 'src/request/xhr';
import has = require('intern/dojo/has');
import Deferred = require('intern/dojo/Deferred');
import * as url from 'url';
import * as http from 'http';

let suite: { [name: string]: any } = {
	name: 'request',

	'default provider'() {
		let provider = request.providerRegistry.match();
		assert.isTrue(provider === nodeRequest || provider === xhrRequest);
	},
};

if (has('host-node')) {
	const serverPort = 8124;
	const serverUrl = 'http://localhost:' + serverPort;
	let server: any;
	let nodeRequest: any;
	let handle: any;

	let getRequestUrl = function (dataKey: string): string {
		return serverUrl + '?dataKey=' + dataKey;
	}

	suite['node'] = {
		setup() {
			const dfd = new Deferred();
			const responseData: { [name: string]: any } = {
				'foo.json': JSON.stringify({foo: "bar"}),
				invalidJson: '<not>JSON</not>'
			};

			function getResponseData(request: any) {
				const urlInfo = url.parse(request.url, true);
				return responseData[urlInfo.query.dataKey];
			}

			server = http.createServer(function(request, response){
				const body = getResponseData(request);
				nodeRequest = request;

				response.writeHead(200, {
					'Content-Length': body.length,
					'Content-Type': 'application/json'
				});
				response.write(body);
				response.end();
			});

			server.on('listening', dfd.resolve);
			server.listen(serverPort);

			return dfd.promise;
		},

		teardown() {
			server.close();
		},

		afterEach() {
			if (handle) {
				handle.destroy();
				handle = null;
			}
		},

		'.get': {
			'simple request'() {
				const dfd = this.async();
				request.get(getRequestUrl('foo.json'))
					.then(
						dfd.callback((response: any) => assert.equal(String(response.data), JSON.stringify({foo: 'bar'}))),
						dfd.reject.bind(dfd)
					);
			},

			'custom headers'() {
				const dfd = this.async();
				const options: RequestOptions = { headers: { 'Content-Type': 'application/json' } };
				request.get(getRequestUrl('foo.json'), options)
					.then(
						dfd.callback((response: any) => {
							assert.equal(String(response.data), JSON.stringify({foo: 'bar'}));
							assert.notProperty(nodeRequest.headers, 'Content-Type', 'expected header to be normalized');
							assert.propertyVal(nodeRequest.headers, 'content-type', 'application/json');
						}),
						dfd.reject.bind(dfd)
					);
			}
		},

		'JSON filter'() {
			const handle = request.filterRegistry.register(/foo\.json$/, (response: Response<any>) => {
				response.data = JSON.parse(String(response.data));
				return response;
			});

			const dfd = this.async();
			request.get(getRequestUrl('foo.json'))
				.then(
					dfd.callback((response: any) => assert.deepEqual(response.data, {foo: 'bar'})),
					dfd.reject.bind(dfd)
				);
		}
	}
}

if (has('host-browser')) {
	let getRequestUrl = function (dataKey: string): string {
		return (<any> require).toUrl('../support/data/' + dataKey);
	}

	suite['browser'] = {
		'.get'() {
			const dfd = this.async();
			request.get(getRequestUrl('foo.json'))
				.then(
					dfd.callback((response: any) => assert.deepEqual(JSON.parse(response.data), { foo: 'bar' })),
					dfd.reject.bind(dfd)
				);
		},

		'JSON filter'() {
			request.filterRegistry.register(/foo.json$/, (response: Response<any>) => {
				response.data = JSON.parse(String(response.data));
				return response;
			});

			let dfd = this.async();
			request.get(getRequestUrl('foo.json'))
				.then(
					dfd.callback((response: any) => assert.deepEqual(response.data, { foo: 'bar' })),
					dfd.reject.bind(dfd)
				);
		}
	}
}

registerSuite(suite);
