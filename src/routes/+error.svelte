<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<h1 class="text-2xl font-bold">{page.status}</h1>
{#if page.error}
	<p>{page.error.message}</p>
{/if}

<button onclick={() => history.back()} class="btn btn-warning"> Go Back </button>

<button onclick={() => goto(resolve('/'))} class="btn btn-success"> Go Home </button>
