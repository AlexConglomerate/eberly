import { generateClient } from 'ebely'

await generateClient({
  // swaggerSchema: ebely.swagger.pathToFile,
  swagger: {
    pathToFile: 'swagger.json',
    // url: 'http://localhost:3000/swagger.json'
  },
  generateClientTo: 'ebely/generated.ts',
})