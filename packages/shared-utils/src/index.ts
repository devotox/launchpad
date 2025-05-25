export const formatProjectName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const createProjectStructure = () => {
  return {
    src: {
      components: {},
      utils: {},
      types: {},
    },
    tests: {},
    docs: {},
  };
};
