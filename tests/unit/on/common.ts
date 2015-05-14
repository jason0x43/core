import assert = require('intern/chai!assert');
import on, { emit } from 'src/on';
import { Handle } from 'src/interfaces';

let handles: Handle[] = [];
function testOn(...args: any[]) {
	let handle = on.apply(null, arguments);
	handles.push(handle);
	return handle;
};

function cleanUpListeners(): void {
	while (handles.length > 0) {
		handles.pop().destroy();
	}
}

interface CustomEvent {
	type: string;
	value?: string;
	cancelable?: boolean;
	preventDefault?: () => void;
}

export default function createCommonTests(args: any) {
	let target: any;
	const testEventName: string = args.eventName;

	return {
		beforeEach() {
			target = args.createTarget();
		},

		afterEach() {
			cleanUpListeners();
			args.destroyTarget && args.destroyTarget(target);
		},

		'on and emit'() {
			let listenerCallCount = 0;
			let emittedEvent: CustomEvent;

			testOn(target, testEventName, function (actualEvent: CustomEvent) {
				listenerCallCount++;
				assert.strictEqual(actualEvent.value, emittedEvent.value);
			});

			emittedEvent = { value: 'foo', type: testEventName };
			emit(target, emittedEvent);
			assert.strictEqual(listenerCallCount, 1);

			emittedEvent = { value: 'bar', type: testEventName };
			emit(target, emittedEvent);
			assert.strictEqual(listenerCallCount, 2);
		},

		'on - multiple event names'() {
			let listenerCallCount = 0;
			let emittedEventType: string;
			let emittedEvent: CustomEvent;

			testOn(target, ['test1', 'test2'], function (actualEvent: CustomEvent) {
				listenerCallCount++;
				if (emittedEventType in actualEvent) {
					assert.strictEqual(actualEvent.type, emittedEventType);
				}
				assert.strictEqual(actualEvent.value, emittedEvent.value);
			});

			emittedEventType = 'test1';
			emittedEvent = { type: emittedEventType, value: 'foo' };
			emit(target, emittedEvent);
			assert.strictEqual(listenerCallCount, 1);

			emittedEventType = 'test2';
			emittedEvent = { type: emittedEventType, value: 'bar' };
			emit(target, emittedEvent);
			assert.strictEqual(listenerCallCount, 2);
		},

		'on - multiple handlers'() {
			const order: any[] = [];
			const customEvent = function (target: any, listener: any) {
				return on(target, 'custom', listener);
			};
			on(target, ['a', 'b'], function (event) {
				order.push(1 + event.type);
			});
			on(target, [ 'a', customEvent ], function (event) {
				order.push(2 + event.type);
			});
			emit(target, { type: 'a' });
			emit(target, { type: 'b' });
			emit(target, { type: 'custom' });
			assert.deepEqual(order, [ '1a', '2a', '1b', '2custom' ]);
		},

		'on - extension events'() {
			let listenerCallCount = 0;
			let emittedEvent: any;
			const extensionEvent = function (target: any, listener: any) {
				return testOn(target, testEventName, listener);
			};

			testOn(target, extensionEvent, function (actualEvent: CustomEvent) {
				listenerCallCount++;
				assert.strictEqual(actualEvent.value, emittedEvent.value);
			});

			emittedEvent = { type: testEventName, value: 'foo' };
			emit(target, emittedEvent);
			assert.strictEqual(listenerCallCount, 1);

			emittedEvent = { type: testEventName, value: 'bar' };
			emit(target, emittedEvent);
			assert.strictEqual(listenerCallCount, 2);
		}
	};
}