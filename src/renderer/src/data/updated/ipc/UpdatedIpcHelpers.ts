export const runRefetch = async <T>(label: string, run: () => Promise<T>): Promise<void> => {
  try {
    await run()
  } catch (error) {
    console.error(`Failed to refetch ${label}:`, error)
  }
}
