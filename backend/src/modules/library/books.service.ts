import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookDto, UpdateBookDto } from './dto/create-book.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateBookDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    const totalCopies = dto.totalCopies ?? 1;
    return this.prisma.book.create({
      data: {
        schoolId: dto.schoolId,
        title: dto.title,
        author: dto.author,
        isbn: dto.isbn,
        category: dto.category,
        publisher: dto.publisher,
        shelfLocation: dto.shelfLocation,
        totalCopies,
        availableCopies: totalCopies,
      },
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string, search?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.book.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { author: { contains: search, mode: 'insensitive' } },
                { isbn: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { title: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const book = await this.prisma.book.findFirst({ where: { id, deletedAt: null } });
    if (!book) throw new NotFoundException('Book not found');
    assertSchoolAccess(currentUser, book.schoolId);
    return book;
  }

  async update(id: string, dto: UpdateBookDto, currentUser: ScopedUser) {
    const book = await this.findOne(id, currentUser);

    // If totalCopies changes, shift availableCopies by the same delta so
    // copies that are currently out on loan aren't silently "found" or lost.
    let availableCopies = book.availableCopies;
    if (dto.totalCopies !== undefined && dto.totalCopies !== book.totalCopies) {
      const delta = dto.totalCopies - book.totalCopies;
      availableCopies = Math.max(0, book.availableCopies + delta);
    }

    return this.prisma.book.update({
      where: { id },
      data: { ...dto, availableCopies },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.book.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
