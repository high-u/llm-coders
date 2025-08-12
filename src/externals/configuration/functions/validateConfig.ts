export const validateConfigStructure = (config: any): boolean => {
	return (
		typeof config === 'object' &&
		config !== null &&
		Array.isArray(config.coders) &&
		config.model &&
		typeof config.model === 'object'
	);
};
