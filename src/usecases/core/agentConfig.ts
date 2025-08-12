export interface Coder {
	id: string;
	name: string;
	endpoint: string;
	model: string;
	modelId: string;
	color: string;
	systemPrompt?: string;
}

export interface CoderDisplayItem extends Coder {
	id: string;
}

export const validateCoder = (coder: any): coder is Coder => {
	return (
		typeof coder === 'object' &&
		coder !== null &&
		typeof coder.name === 'string' &&
		typeof coder.endpoint === 'string' &&
		typeof coder.model === 'string' &&
		typeof coder.modelId === 'string' &&
		typeof coder.color === 'string' &&
		(coder.systemPrompt === undefined || typeof coder.systemPrompt === 'string')
	);
};

export const convertToDisplayItems = (coders: Coder[]): CoderDisplayItem[] => {
	return coders.map(coder => ({
		...coder,
		id: coder.name
	}));
};

export const findCoderByName = (coders: Coder[], name: string): Coder | undefined => {
	return coders.find(coder => coder.name === name);
};