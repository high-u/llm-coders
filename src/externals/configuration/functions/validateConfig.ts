export const validateConfigStructure = (config: any): boolean => {
	return (
		typeof config === 'object' &&
		config !== null &&
		Array.isArray(config.agents)
	);
};
