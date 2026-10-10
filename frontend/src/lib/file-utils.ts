export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Failed to read ${file.name}`))
        return
      }

      resolve(reader.result)
    }
    reader.onerror = () =>
      reject(reader.error || new Error(`Failed to read ${file.name}`))
    reader.readAsDataURL(file)
  })

export const filesToDataUrls = async (files: File[]) =>
  Promise.all(files.map(fileToDataUrl))
