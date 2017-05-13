import Barcode from "../Barcode.js";
import { SHIFT, SET_A, SET_B, MODULO, STOP, ABC, SWAP, BARS } from './constants';

// This is the master class,
// it does require the start code to be included in the string
class CODE128 extends Barcode {
	constructor(data, options) {
		super(data.substring(1), options);

		// Get array of ascii codes from data
		this.bytes = data.split('')
			.map(char => char.charCodeAt(0));
	}

	valid() {
		// ASCII value ranges 0-127, 200-211
		return /^[\x00-\x7F\xC8-\xD3]+$/.test(this.data);
	}

	// The public encoding function
	encode() {
		const bytes = this.bytes;
		// Remove the start code from the bytes and set its index
		const startIndex = bytes.shift() - 105;
		// Get start set by index
		const startSet = ABC[startIndex];

		if (startSet === undefined) {
			throw new RangeError('The encoding does not start with a start character.');
		}

		// Start encode with the right type
		const encodingResult = CODE128.next(bytes, 1, startSet);

		return {
			text:
				this.text === this.data
					? this.text.replace(/[^\x20-\x7E]/g, '')
					: this.text,
			data:
				// Add the start bits
				CODE128.getEncoding(startIndex) +
				// Add the encoded bits
				encodingResult.result +
				// Add the checksum
				CODE128.getEncoding((encodingResult.checksum + startIndex) % MODULO) +
				// Add the end bits
				CODE128.getEncoding(STOP)
		};
	}

	static getEncoding(code) {
		return BARS[code] || '';
	}

	static next(bytes, depth, set) {
		if (!bytes.length) return { result: '', checksum: 0 };
		let nextCode, index;

		// Special characters
		if (bytes[0] >= 200){
			index = bytes.shift() - 105;
			const nextSet = SWAP[index];

			// Swap to other set
			if (nextSet !== undefined) {
				nextCode = CODE128.next(bytes, depth + 1, nextSet);
			}
			// Continue on current set but encode a special character
			else {
				// Shift
				if ((set === SET_A || set === SET_B) && index === SHIFT) {
					// Convert the next character so that is encoded correctly
					bytes[0] = (set === SET_A)
						? bytes[0] > 95 ? bytes[0] - 96 : bytes[0]
						: bytes[0] < 32 ? bytes[0] + 96 : bytes[0];
				}
				nextCode = CODE128.next(bytes, depth + 1, set);
			}
		}
		// Continue encoding
		else {
			// CODE128A
			if (set === SET_A) {
				const charCode = bytes.shift();
				index = charCode < 32 ? charCode + 64 : charCode - 32;
			}
			// CODE128B
			else if (set === SET_B) {
				index = bytes.shift() - 32;
			}
			// CODE128C
			else {
				index = (bytes.shift() - 48) * 10 + bytes.shift() - 48;
			}

			nextCode = CODE128.next(bytes, depth + 1, set);
		}

		// Get the correct binary encoding and calculate the weight
		const enc = CODE128.getEncoding(index);
		const weight = index * depth;

		return {
			result: enc + nextCode.result,
			checksum: weight + nextCode.checksum
		};
	}
}

export default CODE128;
