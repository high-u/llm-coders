export const formatEndpoint = (baseEndpoint: string): string => {
	const trimmedEndpoint = baseEndpoint.endsWith('/') 
		? baseEndpoint.slice(0, -1) 
		: baseEndpoint;
	return `${trimmedEndpoint}/chat/completions`;
};