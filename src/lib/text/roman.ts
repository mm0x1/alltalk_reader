/** Roman numerals for chapter ordinals (1 to 3999; anything else is written in digits). */

const NUMERALS: [number, string][] = [
	[1000, 'M'],
	[900, 'CM'],
	[500, 'D'],
	[400, 'CD'],
	[100, 'C'],
	[90, 'XC'],
	[50, 'L'],
	[40, 'XL'],
	[10, 'X'],
	[9, 'IX'],
	[5, 'V'],
	[4, 'IV'],
	[1, 'I']
];

export function toRoman(value: number): string {
	if (!Number.isInteger(value) || value < 1 || value > 3999) return String(value);
	let rest = value;
	let out = '';
	for (const [amount, numeral] of NUMERALS) {
		while (rest >= amount) {
			out += numeral;
			rest -= amount;
		}
	}
	return out;
}
