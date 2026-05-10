export const formData = (data: any): FormData => {
  const formData = new FormData();
  for (const k of Object.keys(data)) {
    formData.append(k, data[k]);
  }
  return formData;
};
