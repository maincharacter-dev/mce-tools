// Test using the exact same code path as the consolidator
import { createProjectDbPool } from './server/db-connection.js';
import { invokeLLM } from './server/_core/llm.js';
import { normalizeSection, getSectionDisplayName } from './shared/section-normalizer.js';

const projectId = 330004;

async function testConsolidatorPath() {
  console.log('[Test] Creating project DB pool...');
  const projectDb = createProjectDbPool(projectId);
  
  try {
    // Step 1: Get facts (same query as consolidator)
    console.log('[Test] Getting facts using projectDb.execute...');
    const [facts] = await projectDb.execute(
      `SELECT \`key\`, value FROM extracted_facts WHERE project_id = ${projectId} AND deleted_at IS NULL`
    );
    console.log(`[Test] Found ${facts.length} facts`);
    
    // Step 2: Group by section using normalizeSection (same as consolidator)
    const factsBySection = new Map();
    for (const fact of facts) {
      const canonical = normalizeSection(fact.key);
      if (!factsBySection.has(canonical)) {
        factsBySection.set(canonical, []);
      }
      factsBySection.get(canonical).push(fact);
    }
    
    const allSections = Array.from(factsBySection.keys()).filter(s => s !== 'Other');
    console.log(`[Test] Sections found:`, allSections);
    
    // Step 3: Test one section
    const testSection = allSections[0];
    const testFacts = factsBySection.get(testSection);
    console.log(`[Test] Testing section: ${testSection} (${testFacts.length} facts)`);
    
    const displayName = getSectionDisplayName(testSection);
    const factsText = testFacts.map((f, i) => `${i + 1}. ${f.value}`).join('\n');
    
    console.log('[Test] Calling LLM...');
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a technical writing assistant. Synthesize the following project insights into a cohesive, flowing narrative paragraph suitable for executive review. Maintain all factual details but present them as connected prose rather than bullet points.`
        },
        {
          role: 'user',
          content: `Section: ${displayName}\n\nInsights:\n${factsText}\n\nSynthesize these insights into 2-3 well-structured paragraphs.`
        }
      ]
    });
    
    const narrativeContent = response.choices[0]?.message?.content;
    const narrative = typeof narrativeContent === 'string' ? narrativeContent : '';
    console.log(`[Test] Narrative length: ${narrative.length} chars`);
    
    if (narrative) {
      const escapedNarrative = narrative.replace(/'/g, "''");
      
      // Same INSERT as consolidator
      console.log('[Test] Inserting using projectDb.execute...');
      const insertQuery = `INSERT INTO section_narratives (project_id, section_key, narrative) 
         VALUES (${projectId}, '${testSection}', '${escapedNarrative}') 
         ON DUPLICATE KEY UPDATE narrative = '${escapedNarrative}', updated_at = NOW()`;
      
      console.log('[Test] Query (first 200 chars):', insertQuery.substring(0, 200));
      
      await projectDb.execute(insertQuery);
      console.log('[Test] Insert successful!');
      
      // Verify
      const [check] = await projectDb.execute(`SELECT * FROM section_narratives WHERE project_id = ${projectId}`);
      console.log(`[Test] Narratives in table: ${check.length}`);
    }
    
  } catch (error) {
    console.error('[Test] ERROR:', error);
    console.error('[Test] Error stack:', error.stack);
  } finally {
    await projectDb.end();
  }
}

testConsolidatorPath();
