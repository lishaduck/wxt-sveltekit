<script lang="ts">
  let number = $state(0);
</script>

<main class="flex h-full items-center p-2">
  <button
    class="inline-block w-min grow rounded-2xl border-2 bg-green-100 p-1 text-2xl dark:bg-green-900"
    onclick={() => number--}>-</button
  >
  <span class="grow p-1 text-center text-4xl">{number}</span>
  <button
    class="inline-block w-min grow rounded-2xl border-2 bg-green-100 p-1 text-2xl dark:bg-green-900"
    onclick={() => number++}>+</button
  >
</main>
