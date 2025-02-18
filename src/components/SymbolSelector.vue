<template>
  <div class="symbol-selector">
    <input 
      id="symbol" 
      v-model="inputSymbol" 
      @keyup.enter="updateSymbol"
      type="text" 
      placeholder="Enter symbol" 
      class="symbol-input"
    />
  </div>
</template>

<script>
export default {
  name: 'SymbolSelector',
  props: {
    initialSymbol: {
      type: String,
      required: true,
    }
  },
  data() {
    return {
      inputSymbol: this.initialSymbol,
    };
  },
  methods: {
    updateSymbol() {
      // Emit the input symbol back to the parent component
      this.$emit('selected', this.inputSymbol);
    }
  }
};
</script>

<style scoped>
.symbol-selector {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-family: Arial, sans-serif;
}

.symbol-input {
  width: 150px;
  padding: 5px;
  margin-bottom: 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
