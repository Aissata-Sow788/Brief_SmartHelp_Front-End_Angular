import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketResult } from './ticket-result';

describe('TicketResult', () => {
  let component: TicketResult;
  let fixture: ComponentFixture<TicketResult>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketResult],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketResult);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
