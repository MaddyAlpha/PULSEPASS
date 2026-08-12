import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vkgrxibjlpkcfvaogado.supabase.co'
const supabaseKey = 'your-service-role-key' // fake key

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  try {
    const res = await supabase.channel('gate:123').send({
      type: 'broadcast',
      event: 'test',
      payload: { a: 1 }
    })
    console.log('Send result:', res)
  } catch (err) {
    console.error('Send error:', err)
  }
}

test()
