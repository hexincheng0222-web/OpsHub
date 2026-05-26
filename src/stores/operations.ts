import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mockTickets, type Ticket } from '../mock/operations'

export const useOperationsStore = defineStore('operations', () => {
  const tickets = ref<Ticket[]>([...mockTickets])

  const total = computed(() => tickets.value.length)
  const activeCount = computed(() => tickets.value.filter(t => t.status === '进行中').length)
  const doneCount = computed(() => tickets.value.filter(t => t.status === '已完成').length)

  function addTicket(ticket: Ticket) {
    tickets.value.unshift(ticket)
  }

  return { tickets, total, activeCount, doneCount, addTicket }
})
