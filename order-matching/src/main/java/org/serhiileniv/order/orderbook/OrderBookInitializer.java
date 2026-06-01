package org.serhiileniv.order.orderbook;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.repository.OrderRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderBookInitializer implements ApplicationRunner {

    private final OrderRepository orderRepository;
    private final OrderBookManager orderBookManager;

    @Override
    public void run(ApplicationArguments args) {
        List<Order> active = orderRepository.findByStatusIn(
                List.of(OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED));
        for (Order order : active) {
            orderBookManager.getOrCreate(order.getSymbol()).add(order);
        }
        log.info("In-memory order book initialised: {} active orders across {} symbols",
                active.size(), orderBookManager.symbolCount());
    }
}
