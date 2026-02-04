import mysql from 'mysql2/promise';
import { invokeLLM } from './server/_core/llm.js';

const projectId = 330004;

async function testConsolidation() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  
  try {
    // Step 1: Get facts
    console.log('[Test] Getting facts...');
    const [facts] = await pool.execute(
      `SELECT \`key\`, value FROM proj_${projectId}_extracted_facts WHERE deleted_at IS NULL`
    );
    console.log(`[Test] Found ${facts.length} facts`);
    
    // Step 2: Group by key (section)
    const factsBySection = new Map();
    for (const fact of facts) {
      const key = fact.key;
      if (!factsBySection.has(key)) {
        factsBySection.set(key, []);
      }
      factsBySection.get(key).push(fact);
    }
    
    const sections = Array.from(factsBySection.keys()).filter(s => s !== 'Other');
    console.log(`[Test] Sections found:`, sections);
    
    // Step 3: Try generating one narrative
    const testSection = sections[0];
    const testFacts = factsBySection.get(testSection);
    console.log(`[Test] Testing with section: ${testSection} (${testFacts.length} facts)`);
    
    const factsText = testFacts.map((f, i) => `${i + 1}. ${f.value}`).join('\n');
    console.log(`[Test] Facts text length: ${factsText.length} chars`);
    
    console.log('[Test] Calling LLM...');
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a technical writing assistant. Synthesize the following project insights into a cohesive, flowing narrative paragraph suitable for executive review. Maintain all factual details but present them as connected prose rather than bullet points.`
        },
        {
          role: 'user',
          content: `Section: ${testSection}\n\nInsights:\n${factsText}\n\nSynthesize these insights into 2-3 well-structured paragraphs.`
        }
      ]
    });
    
    console.log('[Test] LLM response received');
    const narrativeContent = response.choices[0]?.message?.content;
    const narrative = typeof narrativeContent === 'string' ? narrativeContent : '';
    console.log(`[Test] Narrative length: ${narrative.length} chars`);
    console.log(`[Test] Narrative preview: ${narrative.substring(0, 200)}...`);
    
    // Step 4: Try inserting
    if (narrative) {
      const escapedNarrative = narrative.replace(/'/g, "''");
      console.log('[Test] Inserting narrative...');
      
      await pool.execute(
        `INSERT INTO proj_${projectId}_section_narratives (project_id, section_key, narrative) 
         VALUES (${projectId}, '${testSection}', '${escapedNarrative}') 
         ON DUPLICATE KEY UPDATE narrative = '${escapedNarrative}', updated_at = NOW()`
      );
      console.log('[Test] Insert successful!');
      
      // Verify
      const [check] = await pool.execute(`SELECT * FROM proj_${projectId}_section_narratives`);
      console.log(`[Test] Narratives in table: ${check.length}`);
    }
    
  } catch (error) {
    console.error('[Test] ERROR:', error);
  } finally {
    await pool.end();
  }
}

testConsolidation();
