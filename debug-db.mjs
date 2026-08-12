import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vkgrxibjlpkcfvaogado.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZ3J4aWJqbHBrY2Z2YW9nYWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTMzMzEsImV4cCI6MjEwMDM4OTMzMX0.5r5dDvmjBJADyTEP7DXtccV1KiTuWwPhw4OVEDLrXCE'
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: colleges, error } = await supabase.from('colleges').select('*')
  if (error) {
    console.error('Error fetching colleges:', error)
    return
  }

  for (const col of colleges) {
    if (col.roll_number_regex_blocks) {
      console.log(`\nCollege: ${col.name}`)
      console.log('Regex:', col.roll_number_regex)
      console.log('Blocks:', JSON.stringify(col.roll_number_regex_blocks, null, 2))
    }
  }
}

run()
