class AIQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async add(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      console.log(`[AIQueue] Tarefa adicionada. Fila: ${this.queue.length}`);
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const { taskFn, resolve, reject } = this.queue.shift();
      console.log(`[AIQueue] Processando... Restam ${this.queue.length} na fila`);

      try {
        const result = await taskFn();
        resolve(result);
      } catch (err) {
        reject(err);
      }

      // Pequeno delay entre requisições para evitar rate limit
      await new Promise(res => setTimeout(res, 1000));
    }

    this.processing = false;
    console.log('[AIQueue] Fila vazia');
  }
}

export const aiQueue = new AIQueue();