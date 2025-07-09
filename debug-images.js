// Script de diagnóstico para verificar imagens no IndexedDB
// Execute este script no console do navegador após importar um ZIP

async function debugImageStorage() {
  console.log('🔍 [DEBUG] Iniciando diagnóstico do armazenamento de imagens...');
  
  const DB_NAME = 'StoryWeaverImages';
  const DB_VERSION = 1;
  const IMAGES_STORE = 'images';
  
  try {
    // Abrir IndexedDB
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log('✅ [DEBUG] IndexedDB aberto com sucesso');
    
    // Listar todas as imagens armazenadas
    const transaction = db.transaction([IMAGES_STORE], 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    
    const allImages = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log(`📊 [DEBUG] Total de imagens encontradas: ${allImages.length}`);
    
    if (allImages.length === 0) {
      console.warn('⚠️ [DEBUG] Nenhuma imagem encontrada no IndexedDB!');
      return;
    }
    
    // Analisar cada imagem
    allImages.forEach((image, index) => {
      console.log(`🖼️ [DEBUG] Imagem ${index + 1}:`, {
        id: image.id,
        filename: image.filename,
        type: image.type,
        blobSize: image.data?.size || 'N/A',
        blobType: image.data?.type || 'N/A',
        timestamp: new Date(image.timestamp).toLocaleString(),
        hasValidBlob: image.data instanceof Blob
      });
    });
    
    // Testar recuperação de uma imagem
    if (allImages.length > 0) {
      const testImage = allImages[0];
      console.log(`🧪 [DEBUG] Testando recuperação da imagem: ${testImage.id}`);
      
      try {
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(testImage.data);
        });
        
        console.log('✅ [DEBUG] Imagem convertida para Data URL com sucesso');
        console.log(`📏 [DEBUG] Tamanho do Data URL: ${dataUrl.length} caracteres`);
        console.log(`🔗 [DEBUG] Tipo do Data URL: ${dataUrl.substring(0, 50)}...`);
        
        // Tentar exibir a imagem
        const img = new Image();
        img.onload = () => {
          console.log('✅ [DEBUG] Imagem carregada com sucesso no elemento Image');
          console.log(`📐 [DEBUG] Dimensões: ${img.width}x${img.height}`);
        };
        img.onerror = (error) => {
          console.error('❌ [DEBUG] Erro ao carregar imagem no elemento Image:', error);
        };
        img.src = dataUrl;
        
      } catch (error) {
        console.error('❌ [DEBUG] Erro ao converter imagem para Data URL:', error);
      }
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ [DEBUG] Erro ao acessar IndexedDB:', error);
  }
}

// Função para verificar o estado atual da história
function debugCurrentStory() {
  console.log('📖 [DEBUG] Verificando estado atual da história...');
  
  try {
    const storyData = localStorage.getItem('storyData');
    if (!storyData) {
      console.warn('⚠️ [DEBUG] Nenhuma história encontrada no localStorage');
      return;
    }
    
    const story = JSON.parse(storyData);
    console.log(`📊 [DEBUG] História carregada: ${story.scenes?.length || 0} cenas`);
    
    // Verificar IDs de imagens nas cenas
    if (story.scenes) {
      story.scenes.forEach((scene, index) => {
        console.log(`🎬 [DEBUG] Cena ${index + 1}:`, {
          id: scene.id,
          title: scene.title || 'Sem título',
          generatedImageId: scene.generatedImageId || 'Sem imagem',
          hasBeats: scene.beats?.length > 0,
          beatsCount: scene.beats?.length || 0
        });
        
        // Verificar imagens dos beats
        if (scene.beats) {
          scene.beats.forEach((beat, beatIndex) => {
            if (beat.imageId) {
              console.log(`  🎭 [DEBUG] Beat ${beatIndex + 1}: imageId = ${beat.imageId}`);
            }
            if (beat.videoId) {
              console.log(`  🎥 [DEBUG] Beat ${beatIndex + 1}: videoId = ${beat.videoId}`);
            }
          });
        }
      });
    }
    
    // Verificar voice assignments
    if (story.voiceAssignments) {
      console.log(`🎤 [DEBUG] Voice assignments: ${story.voiceAssignments.length}`);
      story.voiceAssignments.forEach((assignment, index) => {
        if (assignment.imageId) {
          console.log(`👤 [DEBUG] Personagem ${index + 1}: ${assignment.characterName} -> imageId = ${assignment.imageId}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ [DEBUG] Erro ao analisar história:', error);
  }
}

// Executar diagnósticos
console.log('🚀 [DEBUG] Iniciando diagnóstico completo...');
debugImageStorage();
debugCurrentStory();

console.log('ℹ️ [DEBUG] Para executar novamente, digite: debugImageStorage() ou debugCurrentStory()');
